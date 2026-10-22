"""Generate independent, non-personal image-editing fixtures."""
from pathlib import Path
import io
import pymupdf as fitz
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
im=Image.new('RGBA',(360,240),(32,109,167,220));draw=ImageDraw.Draw(im)
draw.ellipse((210,24,300,114),fill=(249,206,98,255));draw.polygon([(0,220),(110,85),(240,240)],fill=(57,163,146,255));draw.polygon([(150,240),(280,110),(360,240)],fill=(108,191,160,255))
buf=io.BytesIO();im.save(buf,format='PNG')
doc=fitz.open();page=doc.new_page(width=500,height=650)
page.insert_text((50,55),'OpenPDF Studio | Image editing',fontsize=20,color=(.2,.3,.5))
page.insert_text((50,88),'图片编辑：拖动移动，四角等比例缩放',fontname='china-s',fontsize=14)
page.insert_image((70,150,310,310),stream=buf.getvalue())
# Deliberately drawn later: image movement must never cover this text or frame.
page.insert_text((90,225),'TEXT ABOVE IMAGE',fontsize=16,color=(0,0,0))
page.draw_rect((60,140,340,340),color=(.3,.4,.6),width=1)
page.insert_text((50,430),'Unchanged paragraph below the image.',fontsize=13)
page=doc.new_page(width=500,height=650);page.insert_text((50,80),'Untouched second page',fontsize=18)
doc.save(root/'test-fixtures/images.pdf')
replacement=Image.new('RGB',(180,120),(178,91,52));replacement.save(root/'test-fixtures/replacement.png')
