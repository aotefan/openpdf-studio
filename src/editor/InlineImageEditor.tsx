import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import {useTranslation} from 'react-i18next';
import type {Doc,ImgObj,Rect} from '../types';

const handles=['nw','n','ne','e','se','s','sw','w'] as const;
type Handle=typeof handles[number];
type Drag={pointer:number;mode:Handle|'move';x:number;y:number;rect:Rect;target:HTMLElement};

export default function InlineImageEditor({doc,page,image,zoom,onTransform,onError}:{
 doc:Doc;page:number;image:ImgObj;zoom:number;onTransform:(rect:Rect)=>Promise<boolean>;onError:(e:unknown)=>void;
}){
 const {t}=useTranslation();const [layer,setLayer]=useState<{image:string;backdrop:string}|null>(null);
 const [failed,setFailed]=useState(false);const [rect,setRect]=useState<Rect>(image.rect);const [moving,setMoving]=useState(false);
 const drag=useRef<Drag|null>(null);const latest=useRef<Rect>(image.rect);const mounted=useRef(true);
 const cancel=()=>{const d=drag.current;drag.current=null;if(d?.target.hasPointerCapture(d.pointer))d.target.releasePointerCapture(d.pointer);latest.current=image.rect;setRect(image.rect);setMoving(false)};
 useEffect(()=>{
  mounted.current=true;let live=true;
  window.studio.rpc<{image:string;backdrop:string}>('image_layer',{sid:doc.id,page,xref:image.xref,scale:1.5})
   .then(r=>{if(live)setLayer(r)}).catch(e=>{if(live){setFailed(true);onError(e)}});
  return()=>{live=false;mounted.current=false};
 },[doc.id,doc.revision,page,image.xref]);
 useEffect(()=>{cancel()},[zoom]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&drag.current){e.preventDefault();e.stopPropagation();cancel()}};
  window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
 });
 const start=(e:PointerEvent<HTMLElement>,mode:Handle|'move')=>{
  if(e.button!==0||!layer)return;e.preventDefault();e.stopPropagation();
  e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
  drag.current={pointer:e.pointerId,mode,x:e.clientX,y:e.clientY,rect:image.rect,target:e.currentTarget};
 };
 const move=(e:PointerEvent)=>{
  const d=drag.current;if(!d||e.pointerId!==d.pointer)return;
  const dx=(e.clientX-d.x)/zoom,dy=(e.clientY-d.y)/zoom;const [x0,y0,x1,y1]=d.rect;
  const w=x1-x0,h=y1-y0,p=doc.pages[page];let r:Rect=[...d.rect];
  if(d.mode==='move'){
   const x=Math.max(0,Math.min(p.width-w,x0+dx)),y=Math.max(0,Math.min(p.height-h,y0+dy));r=[x,y,x+w,y+h];
  }else{
   const west=d.mode.includes('w'),east=d.mode.includes('e'),north=d.mode.includes('n'),south=d.mode.includes('s');
   if(d.mode.length===2&&!e.shiftKey){
    // Corner handles preserve aspect ratio; Shift allows free resizing.
    const fx=west?x1:x0,fy=north?y1:y0;
    const requestedX=1+(west?-dx:dx)/w,requestedY=1+(north?-dy:dy)/h;
    const requested=Math.abs(requestedX-1)>Math.abs(requestedY-1)?requestedX:requestedY;
    const maximum=Math.min((west?fx:p.width-fx)/w,(north?fy:p.height-fy)/h);
    const factor=Math.min(maximum,Math.max(Math.max(12/w,12/h),requested));
    r=[west?fx-w*factor:fx,north?fy-h*factor:fy,west?fx:fx+w*factor,north?fy:fy+h*factor];
   }else{
    if(west)r[0]=Math.max(0,Math.min(x1-12,x0+dx));if(east)r[2]=Math.min(p.width,Math.max(x0+12,x1+dx));
    if(north)r[1]=Math.max(0,Math.min(y1-12,y0+dy));if(south)r[3]=Math.min(p.height,Math.max(y0+12,y1+dy));
   }
  }
  latest.current=r;setRect(r);setMoving(r.some((v,i)=>Math.abs(v-image.rect[i])>.1));
 };
 const finish=async(e:PointerEvent)=>{
  const d=drag.current;if(!d||e.pointerId!==d.pointer)return;e.stopPropagation();drag.current=null;
  if(d.target.hasPointerCapture(d.pointer))d.target.releasePointerCapture(d.pointer);
  const r=latest.current;if(r.every((v,i)=>Math.abs(v-image.rect[i])<.1)){setMoving(false);return}
  const ok=await onTransform(r);if(mounted.current){setMoving(false);if(!ok){latest.current=image.rect;setRect(image.rect)}}
 };
 const style={left:rect[0]*zoom,top:rect[1]*zoom,width:(rect[2]-rect[0])*zoom,height:(rect[3]-rect[1])*zoom};
 // The extracted image follows the pointer only during a drag. After release the
 // PDF engine renders the real stacking order; the original document isn't rasterized.
 return <>
  {moving&&layer&&<><img className="image-drag-backdrop" src={'data:image/png;base64,'+layer.backdrop} alt=""/><img className="image-drag-sprite" style={style} src={'data:image/png;base64,'+layer.image} alt=""/></>}
  {layer&&<div className="image-selection" style={style} data-testid="image-selection" onClick={e=>e.stopPropagation()}>
   <button className="image-move" aria-label={t('moveImage')} title={t('imageDragHint')} onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}/>
   {handles.map(handle=><button key={handle} className={'image-handle handle-'+handle} data-handle={handle} aria-label={t('imageHandle.'+handle)} onPointerDown={e=>start(e,handle)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel}/>)}
  </div>}
  {!layer&&!failed&&<span className="inline-loading" style={{left:style.left,top:style.top+style.height+8}}>{t('busy')}</span>}
 </>;
}
