import sys,io,base64,zipfile,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'engine'))
from core import Engine,EngineError,b64
import pymupdf as f
from PIL import Image
from pypdf import PdfReader
import pytest

@pytest.fixture
def engine():return Engine()
@pytest.fixture
def doc(engine):return engine.open(b64(Path('test-fixtures/research.pdf').read_bytes()),'research.pdf')
def apply(engine,doc,ops):
 p=engine.preview(doc['id'],ops);return engine.commit(doc['id'],p['token'])
def text(engine,doc):
 data=base64.b64decode(engine.export(doc['id'])['data']);return '\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(data)).pages)
def test_text_roundtrip_and_diff(engine,doc):
 s=engine.objects(doc['id'])['texts'][1]
 preview=engine.preview(doc['id'],[{'type':'replaceText','id':s['id'],'expected':s['text'],'text':s['text'].replace('should','must')}])
 assert all(not x.get('outsideRegionChanged') for x in preview['diff'])
 assert all(x['page']==0 for x in preview['diff'])
 assert 'must' not in text(engine,doc)
 engine.commit(doc['id'],preview['token']);assert 'must' in text(engine,doc)
 engine.history(doc['id'],'undo');assert 'must' not in text(engine,doc)
 engine.history(doc['id'],'redo');assert 'must' in text(engine,doc)
def test_chinese(engine,doc):
 s=next(x for x in engine.objects(doc['id'])['texts'] if '中文' in x['text'])
 apply(engine,doc,[{'type':'replaceText','id':s['id'],'text':'中文编辑测试'}]);assert '中文编辑测试' in text(engine,doc)
def test_overflow_atomic(engine,doc):
 before=engine.session(doc['id']).data
 s=engine.objects(doc['id'])['texts'][1]
 with pytest.raises(EngineError,match='textOverflow'):engine.preview(doc['id'],[{'type':'replaceText','id':s['id'],'text':'x'*1000}])
 assert engine.session(doc['id']).data==before
 assert engine.info(doc['id'])['revision']==0

def test_stale_preview(engine,doc):
 p=engine.preview(doc['id'],[{'type':'rotate'}]);engine.commit(doc['id'],p['token'])
 with pytest.raises(EngineError,match='stalePreview'):engine.commit(doc['id'],p['token'])
def test_pages_merge_split(engine,doc):
 apply(engine,doc,[{'type':'rotate'},{'type':'addPage','page':0}]);assert len(engine.info(doc['id'])['pages'])==4
 apply(engine,doc,[{'type':'merge','data':b64(Path('test-fixtures/research.pdf').read_bytes())}]);assert len(engine.info(doc['id'])['pages'])==7
 data=base64.b64decode(engine.export(doc['id'],'split')['data']);z=zipfile.ZipFile(io.BytesIO(data));assert len(z.namelist())==7
 assert all(len(PdfReader(io.BytesIO(z.read(n))).pages)==1 for n in z.namelist())
 assert len(PdfReader(io.BytesIO(base64.b64decode(engine.export(doc['id'],pages=[1,3])['data']))).pages)==2

def test_encrypted_permissions(engine):
 d=f.open();d.new_page();raw=d.tobytes(encryption=f.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='secret')
 with pytest.raises(EngineError,match='encrypted'):engine.open(b64(raw))
 raw=d.tobytes(encryption=f.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='',permissions=f.PDF_PERM_PRINT)
 with pytest.raises(EngineError,match='restricted'):engine.open(b64(raw))
def test_batch_and_ai(engine,doc):
 ops=engine.replace_plan(doc['id'],'should','must');assert len(ops)==6
 apply(engine,doc,ops);assert 'should' not in text(engine,doc)
 assert engine.plan(doc['id'],'旋转第 2 页')['operations'][0]['page']==1
 assert engine.plan(doc['id'],'rotate page 3 by 180 degrees')['operations'][0]['degrees']==180
 with pytest.raises(EngineError,match='unsupportedInstruction'):engine.plan(doc['id'],'run arbitrary python code')
def test_exports(engine,doc):
 from docx import Document
 from openpyxl import load_workbook
 from pptx import Presentation
 for fmt,reader in [('docx',Document),('xlsx',load_workbook),('pptx',Presentation)]:
  raw=base64.b64decode(engine.export(doc['id'],fmt)['data']);assert reader(io.BytesIO(raw)) is not None
 assert len(zipfile.ZipFile(io.BytesIO(base64.b64decode(engine.export(doc['id'],'png')['data']))).namelist())==3

def image_doc(engine,shared=False):
 im=Image.new('RGB',(120,80),'red');b=io.BytesIO();im.save(b,format='PNG')
 d=f.open();p=d.new_page();x=p.insert_image(f.Rect(60,200,300,360),stream=b.getvalue());p.insert_text((60,100),'Text unchanged')
 if shared:d.new_page().insert_image(f.Rect(60,200,300,360),xref=x)
 return engine.open(b64(d.tobytes()),'image.pdf')
def test_image_edits(engine):
 doc=image_doc(engine);o=engine.objects(doc['id'])['images'][0]
 apply(engine,doc,[{'type':'transformImage','xref':o['xref'],'rotate':90,'opacity':.5}]);assert 'Text unchanged' in text(engine,doc)
 o=engine.objects(doc['id'])['images'][0];apply(engine,doc,[{'type':'deleteImage','xref':o['xref']}]);assert 'Text unchanged' in text(engine,doc)
def test_shared_image_rejected(engine):
 doc=image_doc(engine,True);o=engine.objects(doc['id'])['images'][0]
 with pytest.raises(EngineError,match='sharedImage'):engine.preview(doc['id'],[{'type':'deleteImage','xref':o['xref']}])
def test_ocr(engine):
 original=f.open('test-fixtures/research.pdf');d=f.open();p=d.new_page();p.insert_image(p.rect,stream=original[0].get_pixmap(matrix=f.Matrix(2,2)).tobytes('png'))
 Path('test-fixtures/scan.pdf').write_bytes(d.tobytes())
 doc=engine.open(b64(d.tobytes()),'scan.pdf');assert engine.objects(doc['id'])['kind']=='scan'
 p=engine.preview(doc['id'],[{'type':'ocr'}]);assert p['diff']==[]
 engine.commit(doc['id'],p['token']);assert 'OpenPDF' in text(engine,doc)
def test_invalid_and_transaction(engine,doc):
 with pytest.raises(EngineError):engine.open(b64(b'invalid'))
 before=engine.session(doc['id']).data
 with pytest.raises(EngineError):engine.preview(doc['id'],[{'type':'rotate'},{'type':'arbitrary'}])
 assert engine.session(doc['id']).data==before


def test_conversion_scan_detection(engine):
 doc=engine.open(b64(Path('test-fixtures/ocr-batch.pdf').read_bytes()))
 before=engine.session(doc['id']).data
 assert engine.conversion_info(doc['id'])=={'pages':6,'imageOnlyPages':3}
 assert engine.session(doc['id']).data==before
 native=engine.open(b64(Path('test-fixtures/research.pdf').read_bytes()))
 assert engine.conversion_info(native['id'])['imageOnlyPages']==0
