import sys,io,json,base64
from pathlib import Path
import pymupdf as fitz
from PIL import Image
import pytest
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
from core import Engine,EngineError,b64,image_png


def setup():
    raw=Path('test-fixtures/images.pdf').read_bytes();engine=Engine();sid=engine.open(b64(raw),'images.pdf')['id']
    return engine,sid,engine.objects(sid)['images'][0],raw


def test_move_preserves_stream_order_image_bytes_alpha_and_overlaid_text():
    e,sid,image,raw=setup();before=fitz.open(stream=raw,filetype='pdf')
    old_streams=[before.xref_stream(x) for x in before[0].get_contents()]
    pixels=image_png(before,image['xref'])
    candidate=e.preview(sid,[{'type':'transformImage','xref':image['xref'],'expectedRect':image['rect'],'rect':[90,170,330,330]}])
    assert candidate['warnings']==[]
    assert all(row['outsideExact'] for row in candidate['diff'])
    assert e.session(sid).data==raw
    e.commit(sid,candidate['token']);after=fitz.open(stream=e.session(sid).data,filetype='pdf')
    new_streams=[after.xref_stream(x) for x in after[0].get_contents()]
    assert len(old_streams)==len(new_streams)
    assert sum(a!=b for a,b in zip(old_streams,new_streams))==1
    assert image_png(after,e.objects(sid)['images'][0]['xref'])==pixels
    assert before[1].get_pixmap().samples==after[1].get_pixmap().samples
    # Check fully covered foreground glyph pixels (antialiased edges depend
    # on the background color), alongside byte-identical caption streams.
    original_text=before[0].get_text();assert after[0].get_text()==original_text
    rendered=after[0].get_pixmap();original=before[0].get_pixmap()
    black=[(x,y) for x in range(90,280) for y in range(208,226) if original.pixel(x,y)==(0,0,0)]
    assert len(black)>30
    assert all(rendered.pixel(x,y)==(0,0,0) for x,y in black)
    e.history(sid,'undo');assert e.session(sid).data==raw
    e.history(sid,'redo');reopened=e.open(e.export(sid)['data'],'reopened.pdf')['id']
    assert e.objects(reopened)['images'][0]['rect']==pytest.approx([90,170,330,330])
    Path('tests/results/image-move-diff.json').write_text(json.dumps(candidate,indent=2))


def test_image_layer_isolated_and_preserves_alpha():
    e,sid,image,raw=setup()
    candidate=e.preview(sid,[{'type':'rotate'}])
    layer=e.image_layer(sid,0,image['xref'])
    png=Image.open(io.BytesIO(base64.b64decode(layer['image'])))
    assert png.mode=='RGBA' and png.getextrema()[-1][0]<255
    assert e.session(sid).data==raw and not e.info(sid)['canUndo']
    e.commit(sid,candidate['token'])
    assert e.info(sid)['pages'][0]['rotation']==90


@pytest.mark.parametrize('rect',[[90,160,210,240],[70,150,370,350]])
def test_resize_roundtrip(rect):
    e,sid,image,raw=setup();c=e.preview(sid,[{'type':'transformImage','xref':image['xref'],'rect':rect}]);e.commit(sid,c['token'])
    assert e.objects(sid)['images'][0]['rect']==pytest.approx(rect)
    assert all(not row['outsideRegionChanged'] for row in c['diff'])


@pytest.mark.parametrize('problem',['shared','rotated','clipped','combined','outside','stale'])
def test_unsupported_geometry_fails_without_mutation(problem):
    e,sid,image,raw=setup();d=fitz.open(stream=raw,filetype='pdf')
    if problem=='shared':d[1].insert_image((50,80,290,240),xref=image['xref'])
    if problem=='rotated':d[0].set_rotation(90)
    if problem=='clipped':
        c=d[0].get_contents()[2];data=d.xref_stream(c);d.update_stream(c,b'q 0 0 200 650 re W n '+data+b' Q')
    if problem=='combined':d[0].clean_contents()
    raw=d.tobytes();e=Engine();sid=e.open(b64(raw))['id'];image=e.objects(sid)['images'][0]
    op={'type':'transformImage','xref':image['xref'],'rect':[90,170,330,330]}
    if problem=='outside':op['rect']=[-20,20,220,180]
    if problem=='stale':op['expectedRect']=[0,0,20,20]
    with pytest.raises(EngineError):e.preview(sid,[op])
    assert e.session(sid).data==raw and e.info(sid)['revision']==0


def test_delete_removes_selectable_image_without_changing_other_streams():
 e,sid,image,raw=setup()
 candidate=e.preview(sid,[{'type':'deleteImage','xref':image['xref']}])
 assert all(row['outsideExact'] for row in candidate['diff'])
 e.commit(sid,candidate['token']);assert e.objects(sid)['images']==[]
 with fitz.open(stream=raw,filetype='pdf') as a,fitz.open(stream=e.session(sid).data,filetype='pdf') as b:
  old=[a.xref_stream(x) for x in a[0].get_contents()];new=[b.xref_stream(x) for x in b[0].get_contents()]
  assert len(old)==len(new) and sum(x!=y for x,y in zip(old,new))==1
  assert a[0].get_text()==b[0].get_text()
  assert a[1].get_pixmap().samples==b[1].get_pixmap().samples
 reopened=e.open(e.export(sid)['data'])['id'];assert e.objects(reopened)['images']==[]
 e.history(sid,'undo');assert len(e.objects(sid)['images'])==1
 e.history(sid,'redo');assert not e.objects(sid)['images']


def test_delete_complex_image_rejects_without_mutation():
 e,sid,image,raw=setup()
 with fitz.open(stream=raw,filetype='pdf') as d:
  d[0].clean_contents();data=d.tobytes()
 e=Engine();sid=e.open(b64(data))['id'];image=e.objects(sid)['images'][0]
 with pytest.raises(EngineError,match='imageGeometryUnsupported'):e.preview(sid,[{'type':'deleteImage','xref':image['xref']}])
 assert e.session(sid).data==data and not e.info(sid)['canUndo']
