import base64,io,json,sys
from pathlib import Path
import pytest
import pymupdf as f
from pypdf import PdfReader
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
import core
from core import Engine,EngineError,b64

@pytest.fixture
def batch():
 e=Engine();d=e.open(b64(Path('test-fixtures/ocr-batch.pdf').read_bytes()),'ocr-batch.pdf')
 return e,d['id']

def finish(e,sid):
 j=e.ocr_begin(sid,list(range(6)),e.info(sid)['revision'])
 while not j['done']:j=e.ocr_step(j['job'])
 return j,e.ocr_finish(j['job'])

def test_real_batch_pixels_search_save_history(batch):
 e,sid=batch;before=e.session(sid).data
 plan=e.ocr_plan(sid,[5,4,3,2,1,0,0]);assert plan['total']==2
 assert [r['status'] for r in plan['pages']]==['pending','pending','skipText','skipBlank','skipRotation','skipText']
 j,p=finish(e,sid);assert p['diff']==[];assert p['changes']>=6;assert not e.ocr_jobs
 assert e.session(sid).data==before
 e.commit(sid,p['token']);after=e.session(sid).data
 with f.open(stream=before,filetype='pdf') as a,f.open(stream=after,filetype='pdf') as b:
  for i in range(6):
   assert a[i].get_pixmap(matrix=f.Matrix(2,2)).samples==b[i].get_pixmap(matrix=f.Matrix(2,2)).samples
   assert [a.extract_image(x[0])['image'] for x in a[i].get_images()]==[b.extract_image(x[0])['image'] for x in b[i].get_images()]
   if i>=2:assert a[i].get_text()==b[i].get_text()
  assert b[0].search_for('中文文字识别测试');assert b[1].search_for('本地处理保护文档')
 out=base64.b64decode(e.export(sid)['data']);Path('tests/results/ocr-batch.pdf').write_bytes(out)
 reader=PdfReader(io.BytesIO(out));assert len(reader.pages)==6
 assert 'OpenPDF' in reader.pages[0].extract_text();assert '中文文字识别测试' in reader.pages[0].extract_text()
 reopened=e.open(b64(out));assert e.ocr_plan(reopened['id'],[0,1])['total']==0
 e.history(sid,'undo');assert e.session(sid).data==before
 e.history(sid,'redo');assert e.session(sid).data==after
 Path('tests/results/ocr-batch-diff.json').write_text(json.dumps({'pages':6,'renderScale':2,'allPagePixelsExact':True,'scanImageBytesExact':True,'independentReader':'pypdf','preview':p},ensure_ascii=False,indent=2))

def test_cancel_preserves_document_and_previous_preview(batch):
 e,sid=batch;before=e.session(sid).data;p=e.preview(sid,[{'type':'rotate','page':2}])
 j=e.ocr_begin(sid,[0,1],0)['job'];e.ocr_step(j);e.ocr_cancel(j);e.ocr_cancel(j)
 assert not e.ocr_jobs;assert p['token'] in e.previews;assert e.session(sid).data==before
 assert e.info(sid)['revision']==0
 with pytest.raises(EngineError,match='ocrJobMissing'):e.ocr_finish(j)

def test_cancel_after_finalize_discards_candidate(batch):
 e,sid=batch;j,p=finish(e,sid);e.ocr_cancel(j['job'])
 with pytest.raises(EngineError,match='stalePreview'):e.commit(sid,p['token'])
 assert e.info(sid)['revision']==0

def test_later_page_failure_is_atomic(batch,monkeypatch):
 e,sid=batch;before=e.session(sid).data;j=e.ocr_begin(sid,[0,1],0)['job'];e.ocr_step(j)
 def fail(page):raise EngineError('ocrFailed')
 monkeypatch.setattr(core,'recognize_page',fail)
 with pytest.raises(EngineError,match='ocrFailed'):e.ocr_step(j)
 assert not e.ocr_jobs;assert e.session(sid).data==before;assert not e.info(sid)['canUndo']

def test_revision_and_lifecycle(batch):
 e,sid=batch;j=e.ocr_begin(sid,[0,1],0)['job']
 with pytest.raises(EngineError,match='ocrBusy'):e.ocr_begin(sid,[0],0)
 with pytest.raises(EngineError,match='ocrIncomplete'):e.ocr_finish(j)
 p=e.preview(sid,[{'type':'rotate','page':2}]);e.commit(sid,p['token'])
 with pytest.raises(EngineError,match='stalePreview'):e.ocr_step(j)
 assert not e.ocr_jobs
 with pytest.raises(EngineError,match='stalePreview'):e.ocr_begin(sid,[0],0)
 e.ocr_begin(sid,[0],1);e.close(sid);assert not e.ocr_jobs

@pytest.mark.parametrize('pages',[[],[True],[-1],[6],['1'],None])
def test_invalid_pages(batch,pages):
 e,sid=batch
 with pytest.raises(EngineError,match='invalidPage'):e.ocr_plan(sid,pages)

def test_skips_and_no_recognized_text(batch,monkeypatch):
 e,sid=batch
 with pytest.raises(EngineError,match='ocrNoEligible'):e.ocr_begin(sid,[2,3,4,5],0)
 monkeypatch.setattr(core,'recognize_page',lambda p:{'lines':0,'lowConfidence':0,'sample':''})
 j=e.ocr_begin(sid,[0],0)['job'];s=e.ocr_step(j);assert s['pages'][0]['status']=='noText'
 assert e.ocr_step(j)==s
 with pytest.raises(EngineError,match='ocrNoText'):e.ocr_finish(j)
 assert not e.ocr_jobs;assert e.info(sid)['revision']==0

def test_visible_ocr_mutation_rejected(batch,monkeypatch):
 e,sid=batch;before=e.session(sid).data
 def visible(p):
  p.insert_text((30,30),'unexpected');return {'lines':1,'lowConfidence':0,'sample':'unexpected'}
 monkeypatch.setattr(core,'recognize_page',visible)
 j=e.ocr_begin(sid,[0],0)['job']
 with pytest.raises(EngineError,match='outsideRegionChanged'):e.ocr_step(j)
 assert e.session(sid).data==before;assert not e.ocr_jobs
