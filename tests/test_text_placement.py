import sys,io
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
import pymupdf as fitz
import pytest
from core import Engine,EngineError,b64
from pypdf import PdfReader

@pytest.mark.parametrize('rotation',[0,90,180,270])
def test_display_coordinates_roundtrip_and_preserve_content(rotation):
    with fitz.open() as d:
        p=d.new_page(width=400,height=500);p.insert_text((40,40),'Original');p.set_rotation(rotation)
        d.new_page().insert_text((50,50),'Untouched');raw=d.tobytes()
    e=Engine();sid=e.open(b64(raw),'placement.pdf')['id']
    candidate=e.preview(sid,[{'type':'addText','page':0,'text':'Placed here','rect':[60,120,260,180],'size':16,'viewCoordinates':True}])
    assert not any(row.get('outsideRegionChanged') for row in candidate['diff'])
    e.commit(sid,candidate['token']);out=e.session(sid).data
    with fitz.open(stream=raw,filetype='pdf') as old,fitz.open(stream=out,filetype='pdf') as new:
        p=new[0];found=p.search_for('Placed here')[0]*p.rotation_matrix
        # Extracted font ascender boxes extend slightly above the textbox origin.
        assert 59<=found.x0<=61 and abs(found.y0-120)<3
        assert found.width>found.height # upright in displayed coordinates
        assert p.rotation==rotation and 'Original' in p.get_text()
        assert new[1].get_pixmap().samples==old[1].get_pixmap().samples
        assert [new.xref_stream(x) for x in p.get_contents()[:len(old[0].get_contents())]]==[old.xref_stream(x) for x in old[0].get_contents()]
    assert 'Placed here' in PdfReader(io.BytesIO(out)).pages[0].extract_text()
    assert len(e.open(e.export(sid)['data'],'saved.pdf')['pages'])==2
    e.history(sid,'undo');assert e.session(sid).data==raw
    e.history(sid,'redo');assert e.session(sid).data==out

def test_placement_overflow_is_atomic():
    with fitz.open() as d:d.new_page(width=200,height=200);raw=d.tobytes()
    e=Engine();sid=e.open(b64(raw),'small.pdf')['id']
    with pytest.raises(EngineError,match='textBoxOverflow'):
        e.preview(sid,[{'type':'addText','text':'Long text '*100,'rect':[150,150,190,190],'viewCoordinates':True}])
    assert e.session(sid).data==raw and not e.session(sid).undo and not e.previews
