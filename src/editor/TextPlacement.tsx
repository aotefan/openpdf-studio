import {forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Op} from '../types';

export type TextPlacementHandle={finish:()=>Promise<boolean>};
type Point={x:number;y:number};
export default forwardRef<TextPlacementHandle,{width:number;height:number;zoom:number;onCommit:(op:Op)=>Promise<boolean>;onCancel:()=>void}>(function TextPlacement({width,height,zoom,onCommit,onCancel},ref){
 const {t}=useTranslation();const [hover,setHover]=useState<Point|null>(null);const [anchor,setAnchor]=useState<Point|null>(null);const [value,setValue]=useState('');
 const input=useRef<HTMLTextAreaElement>(null);const composing=useRef(false);const pending=useRef(false);
 const point=anchor||hover;
 const size=16;
 const ctx=document.createElement('canvas').getContext('2d');if(ctx)ctx.font='16px Arial, "PingFang SC", sans-serif';
 const lines=value.split('\n');const desired=Math.max(180,...lines.map(line=>(ctx?.measureText(line).width||0)+12));
 const boxWidth=point?Math.min(width-point.x,desired):180;
 const wrapped=lines.reduce((sum,line)=>sum+Math.max(1,Math.ceil((ctx?.measureText(line).width||0)/Math.max(1,boxWidth-4))),0);
 const boxHeight=point?Math.min(height-point.y,Math.max(40,wrapped*24+16)):40;
 const finish=async()=>{
  if(composing.current||pending.current)return false;
  if(!anchor||!value.trim()){onCancel();return true}
  pending.current=true;
  try{return await onCommit({type:'addText',text:value,size,viewCoordinates:true,rect:[anchor.x,anchor.y,anchor.x+boxWidth,anchor.y+boxHeight]})}
  finally{pending.current=false}
 };
 useImperativeHandle(ref,()=>({finish}));
 useLayoutEffect(()=>{if(anchor)input.current?.focus({preventScroll:true})},[anchor]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!composing.current&&!e.isComposing&&!pending.current){e.preventDefault();onCancel()}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[onCancel]);
 const position=(e:React.MouseEvent<HTMLDivElement>):Point=>{
  const rect=e.currentTarget.getBoundingClientRect();
  return {x:Math.max(0,Math.min(width-40,(e.clientX-rect.left)/zoom)),y:Math.max(0,Math.min(height-40,(e.clientY-rect.top)/zoom))};
 };
 const style=point?{left:point.x*zoom,top:point.y*zoom,width:boxWidth*zoom,height:boxHeight*zoom,fontSize:size*zoom,lineHeight:`${24*zoom}px`}:{};
 return <div className="text-placement" data-testid="text-placement" onMouseMove={e=>{if(!anchor)setHover(position(e))}} onMouseLeave={()=>{if(!anchor)setHover(null)}} onClick={e=>{e.stopPropagation();if(anchor)void finish();else setAnchor(position(e))}}>
  {!anchor&&<span className="placement-hint" role="status">{t('placeTextHint')}</span>}
  {point&&!anchor&&<div className="placement-ghost" data-testid="text-placement-ghost" style={style}>{t('placeTextPlaceholder')}</div>}
  {anchor&&<textarea ref={input} data-testid="new-text-input" className="placement-input" aria-label={t('newTextInput')} aria-describedby="new-text-help" style={style} value={value} spellCheck={false}
   onClick={e=>e.stopPropagation()} onChange={e=>setValue(e.target.value)} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false}}
   onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s')return;e.stopPropagation();if(composing.current||e.nativeEvent.isComposing||e.keyCode===229)return;if(e.key==='Escape'){e.preventDefault();onCancel()}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void finish()}}}/>}
  <span id="new-text-help" className="sr-only">{t('placeTextKeys')}</span>
 </div>;
});
