"""Multi-page operations must preserve selected identities and untouched content."""
import base64,io,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
from core import Engine,EngineError,b64
import pymupdf as fitz
from pypdf import PdfReader
import pytest
from copy import deepcopy

def blank_pdf(count):
    with fitz.open() as doc:
        for _ in range(count):doc.new_page(width=72,height=72)
        return doc.tobytes()

@pytest.mark.parametrize('count,operations',[
    (500,[{'type':'addPage','page':499}]),
    (499,[{'type':'addPage','page':498},{'type':'addPage','page':499}]),
    (500,[{'type':'rotate','page':0},{'type':'addPage','page':499}]),
    (500,[{'type':'merge','data':b64(blank_pdf(1))}]),
])
def test_page_limit_rejects_entire_candidate_without_losing_history(count,operations):
    e=Engine();raw=blank_pdf(count);sid=e.open(b64(raw),'boundary.pdf')['id']
    # Keep both undo and redo populated and a valid pending candidate.
    apply(e,sid,[{'type':'rotate','page':0}])
    apply(e,sid,[{'type':'rotate','page':1}]);e.history(sid,'undo')
    pending=e.preview(sid,[{'type':'rotate','page':2}])
    before=deepcopy(e.session(sid));candidates=deepcopy(e.previews)
    with pytest.raises(EngineError,match='^pageLimit$'):e.preview(sid,operations)
    assert e.session(sid)==before and e.previews==candidates
    out=exported(e,sid)
    assert len(PdfReader(io.BytesIO(out)).pages)==count
    reopened=e.open(b64(out),'roundtrip.pdf')
    assert len(reopened['pages'])==count
    e.commit(sid,pending['token'])
    assert e.info(sid)['pages'][2]['rotation']==90

def test_add_page_to_500_can_save_reopen_undo_and_redo(tmp_path):
    e=Engine();raw=blank_pdf(499);sid=e.open(b64(raw),'boundary.pdf')['id']
    apply(e,sid,[{'type':'addPage','page':498}])
    out=tmp_path/'500-pages.pdf';out.write_bytes(exported(e,sid))
    assert len(PdfReader(out).pages)==500
    assert len(e.open(b64(out.read_bytes()),out.name)['pages'])==500
    e.history(sid,'undo');assert e.session(sid).data==raw
    e.history(sid,'redo');assert len(e.info(sid)['pages'])==500
    assert len(e.open(e.export(sid)['data'],'redo.pdf')['pages'])==500

@pytest.fixture
def fixture():
    engine=Engine();raw=Path('test-fixtures/research.pdf').read_bytes()
    doc=engine.open(b64(raw),'pages.pdf')
    return engine,doc['id'],raw

def exported(engine,sid):return base64.b64decode(engine.export(sid)['data'])
def apply(engine,sid,ops):
    preview=engine.preview(sid,ops);engine.commit(sid,preview['token']);return preview

def test_multi_rotate_roundtrip_undo(fixture):
    e,sid,raw=fixture
    preview=e.preview(sid,[{'type':'rotate','page':i,'degrees':90} for i in [0,2]])
    assert e.session(sid).data==raw
    e.commit(sid,preview['token'])
    with fitz.open(stream=raw,filetype='pdf') as before,fitz.open(stream=exported(e,sid),filetype='pdf') as after:
        assert [p.rotation for p in after]==[90,0,90]
        for i in range(3):
            assert before[i].get_text()==after[i].get_text()
            assert [before.xref_stream(x) for x in before[i].get_contents()]==[after.xref_stream(x) for x in after[i].get_contents()]
        assert before[1].get_pixmap().samples==after[1].get_pixmap().samples
    e.history(sid,'undo');assert e.session(sid).data==raw
    e.history(sid,'redo');assert [p.get('/Rotate',0) for p in PdfReader(io.BytesIO(exported(e,sid))).pages]==[90,0,90]

def test_noncontiguous_delete_keeps_correct_page(fixture):
    e,sid,raw=fixture
    apply(e,sid,[{'type':'deletePage','page':i} for i in [2,0]])
    output=exported(e,sid)
    with fitz.open(stream=raw,filetype='pdf') as before,fitz.open(stream=output,filetype='pdf') as after:
        assert len(after)==1
        assert after[0].get_text()==before[1].get_text()
        assert after[0].get_pixmap().samples==before[1].get_pixmap().samples
    assert 'Page 2:' in PdfReader(io.BytesIO(output)).pages[0].extract_text()
    e.history(sid,'undo');assert e.session(sid).data==raw
    e.history(sid,'redo');assert len(PdfReader(io.BytesIO(exported(e,sid))).pages)==1

def test_extraction_does_not_mutate_original(fixture):
    e,sid,raw=fixture
    out=base64.b64decode(e.export(sid,pages=[0,2])['data'])
    assert e.session(sid).data==raw and e.info(sid)['revision']==0
    with fitz.open(stream=raw,filetype='pdf') as before,fitz.open(stream=out,filetype='pdf') as after:
        assert len(after)==2
        for a,b in enumerate([0,2]):
            assert after[a].get_text()==before[b].get_text()
            assert after[a].get_pixmap().samples==before[b].get_pixmap().samples
    assert 'Page 3:' in PdfReader(io.BytesIO(out)).pages[1].extract_text()

def test_delete_all_atomic_and_invalid_extraction(fixture):
    e,sid,raw=fixture
    with pytest.raises(EngineError,match='lastPage'):
        e.preview(sid,[{'type':'deletePage','page':i} for i in [2,1,0]])
    for pages in [[],[-1],[3]]:
        with pytest.raises(EngineError,match='invalidPage'):e.export(sid,pages=pages)
    assert e.session(sid).data==raw and e.info(sid)['revision']==0

def test_reorder_preserves_page_content_links_bookmarks_and_annotations():
    raw=Path('test-fixtures/page-order.pdf').read_bytes();e=Engine();sid=e.open(b64(raw),'order.pdf')['id']
    order=[1,3,5,0,2,4]
    preview=e.preview(sid,[{'type':'reorder','order':order}]);assert e.session(sid).data==raw
    e.commit(sid,preview['token']);out=exported(e,sid)
    with fitz.open(stream=raw,filetype='pdf') as before,fitz.open(stream=out,filetype='pdf') as after:
        for new,old in enumerate(order):
            assert after[new].get_text()==before[old].get_text()
            assert after[new].rect==before[old].rect and after[new].rotation==before[old].rotation
            assert after[new].get_pixmap().samples==before[old].get_pixmap().samples
            assert [after.xref_stream(x) for x in after[new].get_contents()]==[before.xref_stream(x) for x in before[old].get_contents()]
        assert after.get_toc()==[[1,f'Original {i+1}',order.index(i)+1] for i in range(6)]
        link=after[order.index(0)].get_links()[0];assert link['page']==order.index(5) and link['to']==fitz.Point(48,65)
        assert next(after[order.index(2)].annots()).info['content']=='Annotation on original page 3'
    reader=PdfReader(io.BytesIO(out));assert [p.extract_text().splitlines()[0] for p in reader.pages]==[f'PAGE {i+1}' for i in order]
    e.history(sid,'undo');assert e.session(sid).data==raw
    e.history(sid,'redo');assert [x['rotation'] for x in e.info(sid)['pages']]==[0,0,0,0,0,90]

@pytest.mark.parametrize('order',[[0,0,2],[0,1],[0,1,3]])
def test_invalid_page_order_is_atomic(fixture,order):
    e,sid,raw=fixture
    with pytest.raises(EngineError,match='invalidOperation'):e.preview(sid,[{'type':'reorder','order':order}])
    assert e.session(sid).data==raw and e.info(sid)['revision']==0
