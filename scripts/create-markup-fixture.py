from pathlib import Path
import pymupdf as f

d=f.open()
for i in range(4):
 p=d.new_page(width=595,height=842)
 p.insert_text((55,65),f'Keyword markup test - page {i+1}',fontsize=22)
 p.draw_rect(f.Rect(50,100,550,155),fill=(.92,.95,1),color=(.8,.85,.95))
 p.insert_text((60,130),'We should review SHOULD and shouldered.',fontsize=18)
 p.insert_text((60,180),'中文关键词测试：合同应当保留，合同需要校对。',fontname='china-s',fontsize=16)
 p.insert_text((60,225),'Existing note and highlight must be preserved.',fontsize=14)
 if i==0:
  p.add_text_annot((450,300),'Existing reviewer note')
  a=p.add_highlight_annot(p.search_for('Existing',quads=True));a.set_info(title='Original reviewer',content='Keep this annotation');a.update()
 if i==1:p.set_rotation(90)
 if i==2:
  p.insert_text((200,550),'should vertical',fontsize=16,rotate=90)
  p.insert_text((300,520),'should diagonal',fontsize=16,morph=(f.Point(300,520),f.Matrix(25)))
 if i==3:p.set_cropbox(f.Rect(20,30,570,800))
scan=d[0].get_pixmap().tobytes('png');p=d.new_page(width=595,height=842);p.insert_image(p.rect,stream=scan)
d.save('test-fixtures/markups.pdf',garbage=4,deflate=True)
