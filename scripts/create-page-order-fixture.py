from pathlib import Path
import pymupdf as fitz

doc=fitz.open()
for i in range(6):
    p=doc.new_page(width=595 if i%2==0 else 500,height=700+i*20)
    p.insert_text((48,65),f'PAGE {i+1}',fontsize=32,color=(.18,.36,.75))
    p.insert_text((48,110),f'Unique content for original page {i+1}.',fontsize=14)
    p.draw_rect(fitz.Rect(48,160,280+i*20,270+i*12),color=(.2,.4,.7),fill=(.9-i*.04,.94-i*.05,.98-i*.03))
    p.insert_text((48,320),'Generated fixture. No personal documents.',fontsize=10)
doc.set_toc([[1,f'Original {i+1}',i+1] for i in range(6)])
doc[0].insert_link({'kind':fitz.LINK_GOTO,'from':fitz.Rect(48,350,220,375),'page':5,'to':fitz.Point(48,65)})
doc[0].insert_text((48,365),'Jump to original page 6',fontsize=12)
doc[2].add_text_annot((320,190),'Annotation on original page 3')
doc[4].set_rotation(90)
doc.save('test-fixtures/page-order.pdf')
