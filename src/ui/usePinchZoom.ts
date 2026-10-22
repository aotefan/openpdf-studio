import {useEffect,useLayoutEffect,useRef} from 'react';

export const MIN_ZOOM=.25;
export const MAX_ZOOM=4;
export const clampZoom=(value:number)=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));

// Chromium translates macOS trackpad pinches into cancellable Ctrl+wheel events.
// Keep the gesture's page coordinate under the pointer as the PDF grows.
export function usePinchZoom(zoom:number,onZoom:(zoom:number)=>void,documentKey:string){
 const viewport=useRef<HTMLDivElement>(null);
 const paper=useRef<HTMLDivElement>(null);
 const current=useRef({zoom,onZoom});current.current={zoom,onZoom};
 const anchor=useRef<{x:number;y:number;pageX:number;pageY:number}|null>(null);
 const pending=useRef<number|null>(null);const frame=useRef(0);
 useEffect(()=>{
  const element=viewport.current;if(!element)return;
  const wheel=(event:WheelEvent)=>{
   if(!event.ctrlKey||!paper.current)return;
   event.preventDefault();
   if(!Number.isFinite(event.deltaY)||event.deltaY===0)return;
   const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1);
   const rect=paper.current.getBoundingClientRect();
   anchor.current={x:event.clientX,y:event.clientY,pageX:(event.clientX-rect.left)/current.current.zoom,pageY:(event.clientY-rect.top)/current.current.zoom};
   pending.current=clampZoom((pending.current??current.current.zoom)*Math.exp(-delta*.01));
   if(!frame.current)frame.current=requestAnimationFrame(()=>{
    frame.current=0;const value=pending.current;pending.current=null;
    if(value!==null&&value!==current.current.zoom)current.current.onZoom(value);else anchor.current=null;
   });
  };
  element.addEventListener('wheel',wheel,{passive:false});
  return()=>{element.removeEventListener('wheel',wheel);cancelAnimationFrame(frame.current);frame.current=0;pending.current=null;anchor.current=null};
 },[documentKey]);
 useLayoutEffect(()=>{
  if(!anchor.current||!viewport.current||!paper.current)return;
  const a=anchor.current;anchor.current=null;const r=paper.current.getBoundingClientRect();
  viewport.current.scrollLeft+=r.left+a.pageX*zoom-a.x;
  viewport.current.scrollTop+=r.top+a.pageY*zoom-a.y;
 },[zoom]);
 return {viewport,paper};
}
