import sys,io,base64,json
from pathlib import Path
import pytest,pymupdf as f
from pypdf import PdfReader
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
from core import Engine,EngineError,b64

@pytest.fixture
def document():
 e=Engine();data=Path('test-fixtures/markups.pdf').read_bytes();d=e.open(b64(data),'markups.pdf');return e,d['id'],data

def mark(e,sid,query='should',pages=[0,1,2,3],style='highlight',**props):
 plan=e.markup_plan(sid,query,pages,style);p=e.preview(sid,[{**o,**props} for o in plan['operations']]);return plan,p

def integrity(before,after):
 with f.open(stream=before,filetype='pdf') as a,f.open(stream=after,filetype='pdf') as b:
  for i in range(len(a)):
   assert a[i].rect==b[i].rect
   assert a[i].get_text()==b[i].get_text()
   assert [a.xref_stream(x) for x in a[i].get_contents()]==[b.xref_stream(x) for x in b[i].get_contents()]
   assert a[i].get_pixmap(alpha=True,annots=False).samples==b[i].get_pixmap(alpha=True,annots=False).samples

def test_highlight_cjk_rotation_crop_and_external_annotations(document):
 e,sid,before=document;plan,p=mark(e,sid,'合同',[0,1,2,3]);assert plan['total']==8
 assert e.session(sid).data==before;assert all(x['outsideExact'] for x in p['diff']);assert p['markupValidated']
 e.commit(sid,p['token']);after=e.session(sid).data;integrity(before,after)
 assert len(e.markups(sid)['items'])==8
 with f.open(stream=after,filetype='pdf') as d:
  assert sum(a.info.get('title')=='Original reviewer' for a in d[0].annots())==1
  assert sum(a.info.get('content')=='Existing reviewer note' for a in d[0].annots())==1
  assert d[4].get_pixmap().samples==f.open(stream=before,filetype='pdf')[4].get_pixmap().samples
 out=base64.b64decode(e.export(sid)['data']);Path('tests/results/keyword-markups.pdf').write_bytes(out)
 r=PdfReader(io.BytesIO(out));assert len(r.pages)==5
 tagged=[a.get_object() for pg in r.pages for a in pg.get('/Annots',[]) if a.get_object().get('/OpenPDFStudio')=='keyword-markup-v1']
 assert len(tagged)==8;assert all(a['/Subtype']=='/Highlight' and len(a['/QuadPoints'])==8 and a['/Contents']=='合同' for a in tagged)
 reopened=e.open(b64(out));assert len(e.markups(reopened['id'])['items'])==8
 e.history(sid,'undo');assert e.session(sid).data==before;e.history(sid,'redo');assert e.session(sid).data==after
 Path('tests/results/keyword-markup-diff.json').write_text(json.dumps({'baseContentStreamsExact':True,'basePremultipliedPixelsExact':True,'independentReader':'pypdf','preview':p},ensure_ascii=False,indent=2))

@pytest.mark.parametrize('style,kind',[('highlight',f.PDF_ANNOT_HIGHLIGHT),('underline',f.PDF_ANNOT_UNDERLINE),('strikeout',f.PDF_ANNOT_STRIKE_OUT)])
def test_types_diagonal_duplicate_and_selective_removal(document,style,kind):
 e,sid,before=document;plan,p=mark(e,sid,style=style,color='#3366cc',opacity=.65);assert plan['total']>=12;e.commit(sid,p['token'])
 integrity(before,e.session(sid).data);rows=e.markups(sid);assert len(rows['items'])==plan['total']
 again=e.markup_plan(sid,'should',[0,1,2,3],style);assert again['total']==0 and again['duplicates']==plan['total']
 with f.open(stream=e.session(sid).data,filetype='pdf') as d:
  for row in rows['items']:
   p=d[row['page']];a=p.load_annot(row['xref']);assert a.type[0]==kind;assert abs(a.opacity-.65)<.001
 ops=[{'type':'deleteMarkup','revision':rows['revision'],'page':a['page'],'xref':a['xref'],'id':a['id']} for a in rows['items']]
 preview=e.preview(sid,ops);e.commit(sid,preview['token']);assert not e.markups(sid)['items'];integrity(before,e.session(sid).data)
 with f.open(stream=before,filetype='pdf') as a,f.open(stream=e.session(sid).data,filetype='pdf') as b:
  assert all(a[i].get_pixmap(alpha=True).samples==b[i].get_pixmap(alpha=True).samples for i in range(len(a)))
 e.history(sid,'undo');assert len(e.markups(sid)['items'])==plan['total']

def test_plan_range_scan_staleness_and_no_matches(document):
 e,sid,before=document;plan=e.markup_plan(sid,'should',[1,1]);assert len(plan['operations'])==1
 assert e.markup_plan(sid,'合同',[4])['total']==0;assert e.markup_plan(sid,'not-present',[0])['total']==0
 p=e.preview(sid,[{'type':'rotate','page':0}]);e.markup_plan(sid,'should',[0]);assert p['token'] in e.previews
 e.commit(sid,p['token'])
 with pytest.raises(EngineError,match='stalePreview'):e.preview(sid,plan['operations'])

@pytest.mark.parametrize('query,pages,style',[('',[0],'highlight'),('x'*201,[0],'highlight'),('should',[], 'highlight'),('should',[True],'highlight'),('should',[5],'highlight'),('should',[0],'other')])
def test_invalid_plan_is_read_only(document,query,pages,style):
 e,sid,before=document
 with pytest.raises(EngineError):e.markup_plan(sid,query,pages,style)
 assert e.session(sid).data==before

def test_invalid_properties_and_foreign_removal_are_atomic(document):
 e,sid,before=document;plan=e.markup_plan(sid,'should',[0])
 for props in [{'color':'invalid'},{'opacity':0},{'opacity':float('nan')}]:
  with pytest.raises(EngineError):e.preview(sid,[{**plan['operations'][0],**props}])
  assert e.session(sid).data==before
 with f.open(stream=before,filetype='pdf') as d:
  p=d[0];a=next(p.annots());op={'type':'deleteMarkup','page':0,'xref':a.xref,'id':a.info['id'],'revision':0}
 with pytest.raises(EngineError,match='staleObject'):e.preview(sid,[*plan['operations'],op])
 assert e.session(sid).data==before


def test_markup_cannot_bypass_content_integrity_with_mixed_operations(document):
 e,sid,before=document;plan=e.markup_plan(sid,'should',[0])
 with pytest.raises(EngineError,match='invalidOperation'):e.preview(sid,[*plan['operations'],{'type':'addText','page':0,'text':'extra','x':30,'y':30}])
 assert e.session(sid).data==before
