import base64, io, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
import pymupdf as fitz
from PIL import Image, ImageChops
import pytest
from core import Engine, EngineError, b64, png

def test_backdrop_preserves_session_and_existing_preview():
    engine=Engine(); source=Path('test-fixtures/research.pdf').read_bytes()
    doc=engine.open(b64(source),'sample.pdf');sid=doc['id']
    target=engine.objects(sid)['texts'][1]
    candidate=engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':target['text'].replace('should','must')}])
    backdrop=engine.text_backdrop(sid,0,target['id'],1)
    assert Image.open(io.BytesIO(base64.b64decode(backdrop['image']))).size==(595,842)
    assert engine.session(sid).data==source
    assert engine.info(sid)['revision']==0
    assert engine.info(sid)['canUndo'] is False
    assert len(engine.sessions)==1
    # Editing background must not invalidate a candidate that is already being reviewed.
    engine.commit(sid,candidate['token'])
    assert 'must' in engine.objects(sid)['texts'][1]['text']

def test_backdrop_preserves_color_image_and_table_outside_text():
    doc=fitz.open();page=doc.new_page(width=400,height=300)
    page.draw_rect((0,0,400,300),fill=(.3,.7,.9),color=None)
    image=Image.new('RGB',(16,16),(25,70,100));data=io.BytesIO();image.save(data,format='PNG')
    page.insert_image((50,50,350,200),stream=data.getvalue())
    page.draw_rect((30,30,370,250),color=(1,0,0),width=2)
    page.insert_text((70,100),'Inline text should preserve background',fontsize=12,color=(1,1,1))
    raw=doc.tobytes();engine=Engine();sid=engine.open(b64(raw))['id'];target=engine.objects(sid)['texts'][0]
    actual=Image.open(io.BytesIO(base64.b64decode(engine.text_backdrop(sid,0,target['id'],1)['image']))).convert('RGB')
    page.add_redact_annot(fitz.Rect(target['rect']),fill=False);page.apply_redactions(images=0,graphics=0,text=0)
    expected=Image.open(io.BytesIO(png(page,1))).convert('RGB')
    assert ImageChops.difference(actual,expected).getbbox() is None
    assert actual.getpixel((80,95))==(25,70,100)
    assert actual.getpixel((10,10))!=(255,255,255)
    assert engine.session(sid).data==raw

def test_backdrop_rejects_rotated_page_without_mutation():
    doc=fitz.open();page=doc.new_page();page.insert_text((50,80),'Rotated');page.set_rotation(90)
    raw=doc.tobytes();engine=Engine();sid=engine.open(b64(raw))['id'];target=engine.objects(sid)['texts'][0]
    with pytest.raises(EngineError,match='rotatedText'):engine.text_backdrop(sid,0,target['id'])
    assert engine.session(sid).data==raw


def test_mixed_cjk_form_text_measured_with_actual_embedded_font():
    doc=fitz.open();page=doc.new_page()
    page.insert_text((70,100),'姓名：__________ ',fontname='china-s',fontsize=12)
    page.insert_text((70,160),'Unaffected text and rule')
    page.draw_line((70,170),(300,170))
    raw=doc.tobytes();engine=Engine();sid=engine.open(b64(raw))['id']
    target=engine.objects(sid)['texts'][0]
    replacement='姓名：________某姓名________   '
    available=target['rect'][2]-target['rect'][0]
    # The old built-in font measurement rejects text that the embedded font fits.
    assert fitz.get_text_length(replacement,fontname='china-s',fontsize=12)>available
    assert fitz.Font('cjk').text_length(replacement,fontsize=12)<=available
    candidate=engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':replacement}])
    assert all(row.get('outsideExact') for row in candidate['diff'])
    engine.commit(sid,candidate['token'])
    assert replacement.strip() in ''.join(s['text'] for s in engine.objects(sid)['texts'])
    assert 'Unaffected text and rule' in ''.join(s['text'] for s in engine.objects(sid)['texts'])


def growing_document(obstacle=None):
    doc=fitz.open();page=doc.new_page(width=500,height=500)
    page.insert_text((60,100),'姓名：___',fontname='china-s',fontsize=12)
    page.insert_text((60,200),'Unchanged paragraph',fontsize=12)
    if obstacle=='text':page.insert_text((190,100),'Neighbor',fontname='cour',fontsize=12)
    if obstacle=='image':
        buf=io.BytesIO();Image.new('RGB',(20,20),'blue').save(buf,format='PNG');page.insert_image((190,80,230,110),stream=buf.getvalue())
    if obstacle=='table':page.draw_line((190,60),(190,130))
    doc.new_page(width=500,height=500).insert_text((60,100),'Untouched second page')
    raw=doc.tobytes();engine=Engine();sid=engine.open(b64(raw))['id'];target=engine.objects(sid)['texts'][0]
    return engine,sid,target,raw


def test_text_grows_into_whitespace_and_roundtrips_with_undo():
    engine,sid,target,raw=growing_document()
    replacement='姓名：测试文字自动向右扩展并保留完整内容'
    before=fitz.open(stream=raw,filetype='pdf');preview=engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':replacement}])
    assert all(row['outsideExact'] for row in preview['diff'])
    engine.commit(sid,preview['token'])
    updated=engine.objects(sid)['texts'];new=next(s for s in updated if s['text']==replacement)
    assert new['rect'][2]>target['rect'][2]+120 and new['size']==target['size']
    assert any(s['text']=='Unchanged paragraph' for s in updated)
    after=fitz.open(stream=engine.session(sid).data,filetype='pdf')
    assert before[1].get_pixmap().samples==after[1].get_pixmap().samples
    reopened=engine.open(engine.export(sid)['data'])['id'];assert replacement in ''.join(x['text'] for x in engine.objects(reopened)['texts'])
    engine.history(sid,'undo');assert engine.session(sid).data==raw
    engine.history(sid,'redo');assert replacement in ''.join(x['text'] for x in engine.objects(sid)['texts'])
    import json
    Path('tests/results/expanded-text-diff.json').write_text(json.dumps(preview,indent=2))


@pytest.mark.parametrize('obstacle',['text','image','table'])
def test_expansion_conflicts_are_specific_and_atomic(obstacle):
    engine,sid,target,raw=growing_document(obstacle)
    with pytest.raises(EngineError,match='textExpansionConflict'):
        engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':'姓名：文字扩展不能覆盖右侧已有的其他内容'}])
    assert engine.session(sid).data==raw


def test_expansion_page_edge_and_newline_errors():
    engine,sid,target,raw=growing_document()
    with pytest.raises(EngineError,match='textOverflow'):engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':'测试'*100}])
    with pytest.raises(EngineError,match='invalidTextLayout'):engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':'测试\n文字'}])
    assert engine.session(sid).data==raw


def test_font_size_grows_the_region_without_changing_other_objects():
    engine,sid,target,raw=growing_document()
    preview=engine.preview(sid,[{'type':'replaceText','id':target['id'],'text':'姓名：测试','size':24}])
    engine.commit(sid,preview['token']);new=next(x for x in engine.objects(sid)['texts'] if x['text']=='姓名：测试')
    assert new['size']==24 and new['rect'][1]<target['rect'][1]
    assert all(row['outsideExact'] for row in preview['diff'])


def test_layout_query_is_readonly_and_matches_expanded_candidate():
    engine,sid,target,raw=growing_document();preview=engine.preview(sid,[{'type':'rotate'}])
    layout=engine.text_layout(sid,0,target['id'],'姓名：自动扩展区域测试')
    assert layout['rect'][2]>target['rect'][2] and engine.session(sid).data==raw
    assert engine.info(sid)['revision']==0 and not engine.info(sid)['canUndo']
    engine.commit(sid,preview['token'])
