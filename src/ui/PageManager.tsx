import {useEffect,useRef,useState,type DragEvent} from 'react';
import {useTranslation} from 'react-i18next';
import {RotateCw,RotateCcw,Trash2,FileOutput,Check,ArrowLeft,ArrowRight,Undo2} from 'lucide-react';
import type {Doc,Op} from '../types';
import {Modal} from './primitives';
import {PageImage} from './Viewer';
import {parsePageRange,formatPageRange,movePages,stepPages} from '../pdf/pageSelection';

function PageCard({doc,index,position,selected,onSelect,onError,dragProps}:{doc:Doc;index:number;position:number;selected:boolean;onSelect:(shift:boolean)=>void;onError:(e:unknown)=>void;dragProps:{draggable:boolean;onDragStart:(e:DragEvent<HTMLButtonElement>)=>void;onDragOver:(e:DragEvent<HTMLButtonElement>)=>void;onDragEnd:()=>void;'data-drop':string}}){
 const {t}=useTranslation();const ref=useRef<HTMLButtonElement>(null);const [visible,setVisible]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'100px'});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect()},[]);
 const page=doc.pages[index];
 return <button ref={ref} type="button" {...dragProps} data-source-page={index+1} className={'managed-page '+(selected?'selected':'')} aria-pressed={selected} aria-label={t('pageOrderCard',{position:position+1,page:index+1})} onClick={e=>onSelect(e.shiftKey)}>
  <span className="page-check" aria-hidden="true">{selected&&<Check size={12}/>}</span>
  <div className="managed-page-image" style={{aspectRatio:`${page.width}/${page.height}`}}>{visible&&<PageImage doc={doc} page={index} scale={.22} onError={onError}/>}</div>
  <span>{position+1}</span><small>{t('sourcePage',{page:index+1})}</small>
 </button>;
}

export default function PageManager({doc,currentPage,onClose,onApply,onExport}:{doc:Doc;currentPage:number;onClose:()=>void;onApply:(ops:Op[])=>Promise<boolean>;onExport:(pages:number[])=>Promise<boolean>}){
 const {t}=useTranslation();const [order,setOrder]=useState(()=>doc.pages.map((_,i)=>i));const [gap,setGap]=useState<number|null>(null);const drag=useRef<number[]|null>(null);const grid=useRef<HTMLDivElement>(null);const pending=order.some((p,i)=>p!==i);const [range,setRange]=useState(String(currentPage+1));const [anchor,setAnchor]=useState(currentPage);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 let selected:number[]=[],valid=true;try{selected=parsePageRange(range,doc.pages.length)}catch{valid=false}
 const choose=(pages:number[])=>{setRange(formatPageRange(pages));setMessage('');setError('')};
 const select=(index:number,shift:boolean)=>{
  if(shift){const from=Math.min(order.indexOf(anchor),order.indexOf(index)),to=Math.max(order.indexOf(anchor),order.indexOf(index));choose([...selected,...order.slice(from,to+1)])}
  else{choose(selected.includes(index)?selected.filter(i=>i!==index):[...selected,index]);setAnchor(index)}
 };
 const invoke=async(action:()=>Promise<boolean>,exporting=false,reordering=false)=>{
  if(busy||(!reordering&&(!valid||!selected.length)))return;setBusy(true);setError('');setMessage('');
  try{const done=await action();if(exporting&&done)setMessage(t('pagesExported',{count:selected.length}));else if(!exporting&&!done)setError(t('error.operationFailed'))}
  catch{setError(t('error.operationFailed'))}finally{setBusy(false)}
 };
 const setSequence=(next:number[])=>{setOrder(next);setError('');setMessage('')};
 const resetDrag=()=>{drag.current=null;setGap(null)};
 const dragStart=(index:number,e:DragEvent<HTMLButtonElement>)=>{
  if(busy||!valid){e.preventDefault();return}
  const moving=selected.includes(index)?selected:[index];if(!selected.includes(index))choose(moving);
  drag.current=moving;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-openpdf-pages',JSON.stringify(moving));
 };
 const dragOver=(e:DragEvent<HTMLElement>,at:number)=>{
  if(!drag.current||busy)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';setGap(at);
  const bounds=grid.current?.getBoundingClientRect();if(bounds){if(e.clientY<bounds.top+35)grid.current?.scrollBy(0,-18);if(e.clientY>bounds.bottom-35)grid.current?.scrollBy(0,18)}
 };
 const drop=(e:DragEvent<HTMLDivElement>)=>{
  if(!drag.current||gap===null||busy)return;e.preventDefault();
  setSequence(movePages(order,drag.current,gap));resetDrag();
 };
 const earlier=stepPages(order,selected,-1),later=stepPages(order,selected,1);
 const same=(next:number[])=>next.every((p,i)=>p===order[i]);
 const rotate=(degrees:number)=>invoke(()=>onApply(selected.map(page=>({type:'rotate',page,degrees}))));
 return <Modal title="pageManager" wide onClose={()=>{if(!busy)onClose()}}>
  <fieldset className="page-manager" disabled={busy} aria-busy={busy}>
   <div className="page-manager-controls">
    <label className="page-range">{t('pageRange')}<input aria-label={t('pageRange')} aria-invalid={!valid} aria-describedby="page-range-help" placeholder={t('pageRangeExample')} value={range} onChange={e=>{setRange(e.target.value);setMessage('');setError('')}}/></label>
    <button onClick={()=>choose(doc.pages.map((_,i)=>i))}>{t('selectAll')}</button>
    <button onClick={()=>choose(doc.pages.map((_,i)=>i).filter(i=>!selected.includes(i)))}>{t('invertSelection')}</button>
    <button onClick={()=>choose([])}>{t('clearSelection')}</button>
   </div>
   <div className="page-manager-summary">
    <p id="page-range-help" className="hint">{t('pageSelectionHint')}</p><p className="hint">{t('pageDragHint')}</p>
    {valid?<p role="status">{t('pagesSelected',{count:selected.length,total:doc.pages.length})}</p>:<p role="alert" className="error">{t('error.pageRangeInvalid',{total:doc.pages.length})}</p>}
    {valid&&selected.length===doc.pages.length&&<p className="hint">{t('keepOnePage')}</p>}
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="page-export-success">{message}</p>}
   </div>
   <div className="page-order-tools">
    <button disabled={!valid||!selected.length||same(earlier)} onClick={()=>setSequence(earlier)}><ArrowLeft size={15}/>{t('moveSelectedEarlier')}</button>
    <button disabled={!valid||!selected.length||same(later)} onClick={()=>setSequence(later)}><ArrowRight size={15}/>{t('moveSelectedLater')}</button>
    {pending&&<><button onClick={()=>setSequence(doc.pages.map((_,i)=>i))}><Undo2 size={15}/>{t('resetPageOrder')}</button><button className="primary" onClick={()=>invoke(()=>onApply([{type:'reorder',order}]),false,true)}>{t('applyPageOrder')}</button></>}
   </div>
   {pending&&<p role="status" className="page-order-notice">{t('pendingPageOrder')}</p>}
   <div ref={grid} className={'page-manager-grid '+(gap===order.length?'drop-at-end':'')} aria-label={t('thumbnails')} onDragOver={e=>{if(!(e.target as HTMLElement).closest('.managed-page'))dragOver(e,order.length)}} onDrop={drop} onKeyDown={e=>{if(e.key==='Escape'&&drag.current){e.preventDefault();e.stopPropagation();resetDrag()}}}>
    {order.map((index,position)=><PageCard key={index} doc={doc} index={index} position={position} selected={selected.includes(index)} onSelect={shift=>select(index,shift)} onError={()=>setError(t('error.operationFailed'))} dragProps={{draggable:!busy&&valid,onDragStart:e=>dragStart(index,e),onDragEnd:resetDrag,onDragOver:e=>{const box=e.currentTarget.getBoundingClientRect();dragOver(e,position+(e.clientX>box.x+box.width/2?1:0))},'data-drop':gap===position?'before':gap===position+1?'after':''}}/>)}
   </div>
   <footer>
    <button disabled={pending||!valid||!selected.length} onClick={()=>rotate(-90)}><RotateCcw size={16}/>{t('rotateCounterclockwise')}</button>
    <button disabled={pending||!valid||!selected.length} onClick={()=>rotate(90)}><RotateCw size={16}/>{t('rotateClockwise')}</button>
    <button className="danger" disabled={pending||!valid||!selected.length||selected.length===doc.pages.length} onClick={()=>invoke(()=>onApply([...selected].reverse().map(page=>({type:'deletePage',page}))))}><Trash2 size={16}/>{t('deleteSelectedPages')}</button>
    <button className="primary" disabled={pending||!valid||!selected.length} onClick={()=>invoke(()=>onExport(selected),true)}><FileOutput size={16}/>{t('extractSelectedPages')}</button>
   </footer>
   {busy&&<p className="page-manager-progress" role="status">{t('busy')}</p>}
  </fieldset>
 </Modal>;
}
