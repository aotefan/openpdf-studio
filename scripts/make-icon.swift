import AppKit
let output=CommandLine.arguments[1]
let image=NSImage(size:NSSize(width:1024,height:1024))
image.lockFocus()
NSColor(calibratedRed:0.19,green:0.37,blue:0.77,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:36,y:36,width:952,height:952),xRadius:210,yRadius:210).fill()
NSColor.white.setStroke()
let page=NSBezierPath();page.lineWidth=35;page.lineJoinStyle = .round
page.move(to:NSPoint(x:300,y:240));page.line(to:NSPoint(x:300,y:784));page.line(to:NSPoint(x:590,y:784));page.line(to:NSPoint(x:740,y:634));page.line(to:NSPoint(x:740,y:240));page.close();page.stroke()
let fold=NSBezierPath();fold.lineWidth=32;fold.lineJoinStyle = .round;fold.move(to:NSPoint(x:590,y:784));fold.line(to:NSPoint(x:590,y:634));fold.line(to:NSPoint(x:740,y:634));fold.stroke()
for y in [525,425,325] {let line=NSBezierPath();line.lineWidth=28;line.lineCapStyle = .round;line.move(to:NSPoint(x:390,y:y));line.line(to:NSPoint(x:y==325 ? 555:650,y:y));line.stroke()}
image.unlockFocus()
let rep=NSBitmapImageRep(data:image.tiffRepresentation!)!
try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:output))
