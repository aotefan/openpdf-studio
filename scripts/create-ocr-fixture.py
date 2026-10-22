"""Synthetic OCR fixture; never uses personal PDF content."""
from pathlib import Path
import pymupdf as f
source=f.open()
for title,cn in [('OpenPDF Studio batch OCR','中文文字识别测试'),('Searchable document page two','本地处理保护文档')]:
 p=source.new_page(width=595,height=700)
 p.insert_text((50,90),title,fontsize=24)
 p.insert_text((50,150),cn,fontname='china-s',fontsize=24)
 p.insert_text((50,210),'Invoice number 2026. Total 125 dollars.',fontsize=18)
 p.insert_text((50,270),'Generated test document. No personal information.',fontsize=15)
d=f.open()
for p in source:
 q=d.new_page(width=595,height=700);q.insert_image(q.rect,stream=p.get_pixmap(matrix=f.Matrix(2,2)).tobytes('png'))
p=d.new_page(width=595,height=700);p.insert_text((50,90),'Existing searchable text must stay unchanged.',fontsize=20)
d.new_page(width=595,height=700)
p=d.new_page(width=595,height=700);p.insert_image(p.rect,stream=source[0].get_pixmap().tobytes('png'));p.set_rotation(90)
p=d.new_page(width=595,height=700);p.insert_image(p.rect,stream=source[1].get_pixmap().tobytes('png'));p.insert_text((50,640),'Mixed page already has text.',fontsize=15)
d.save('test-fixtures/ocr-batch.pdf',garbage=4,deflate=True)
