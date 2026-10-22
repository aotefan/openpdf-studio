import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal} from '../ui/primitives';
import {parsePageRange,formatPageRange} from '../pdf/pageSelection';
import type {Doc,Op,Preview,MarkupPlan,MarkupItem} from '../types';
export default function MarkupDialog({doc,initialStyle='highlight',manage=false,onClose,onReady,onApply}:{doc:Doc;initialStyle?:string;manage?:boolean;onClose:()=>void;onReady:(p:Preview)=>void;onApply:(p:Preview)=>Promise<boolean>}){
 const {t}=useTranslation();const [query,setQuery]=useState(''),[range,setRange]=useState(doc.pages.length===1?'1':`1-${doc.pages.length}`),[style,setStyle]=useState(initialStyle);
 const [color,setColor]=useState(initialStyle==='highlight'?'#ffe066':'#d6334c'),[opacity,setOpacity]=useState(initialStyle==='highlight'?.45:1);
 const [plan,setPlan]=useState<(MarkupPlan&{key:string})|null>(null),[items,setItems]=useState<MarkupItem[]>([]),[selected,setSelected]=useState<Set<number>>(new Set());
 const [checking,setChecking]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 let pages:number[]=[],valid=true;try{pages=parsePageRange(range,doc.pages.length);if(!pages.length)valid=false}catch{valid=false}
 const key=JSON.stringify([query,range,style]);
 const message=(e:unknown)=>t('error.'+(String(e).split(': ').pop()||'operationFailed'),{defaultValue:t('error.operationFailed')});
 useEffect(()=>{
  let live=true;setChecking(true);setPlan(null);setError('');
  if(manage){window.studio.rpc<{items:MarkupItem[]}>('markups',{sid:doc.id}).then(r=>{if(live)setItems(r.items)}).catch(e=>{if(live)setError(message(e))}).finally(()=>{if(live)setChecking(false)});return()=>{live=false}}
  if(!valid||!query.trim()){setChecking(false);return}
  const timer=setTimeout(()=>window.studio.rpc<MarkupPlan>('markup_plan',{sid:doc.id,query,pages,style}).then(r=>{if(live)setPlan({...r,key})}).catch(e=>{if(live)setError(message(e))}).finally(()=>{if(live)setChecking(false)}),160);
  return()=>{live=false;clearTimeout(timer)};
 },[doc.id,doc.revision,key,manage]);
 const submit=async(preview=false)=>{
  if(lock.current||checking||(!manage&&(!plan||plan.key!==key||!plan.total))||(manage&&!selected.size))return;
  lock.current=true;setBusy(true);setError('');
  try{
   const operations:Op[]=manage?items.filter(a=>selected.has(a.xref)).map(a=>({type:'deleteMarkup',page:a.page,xref:a.xref,id:a.id,revision:doc.revision})):plan!.operations.map(o=>({...o,color,opacity}));
   const p=await window.studio.rpc<Preview>('preview',{sid:doc.id,operations});
   const result={...p,focusPage:operations[0].page,summary:manage?t('markupDeleteSummary',{count:selected.size}):t('markupSummary',{count:p.changes,query,pages:formatPageRange(pages),style:t('markup.'+style)})};
   if(preview)onReady(result);else if(!await onApply(result))setError(t('error.operationFailed'));
  }catch(e){setError(message(e))}finally{lock.current=false;setBusy(false)}
 };
 return <Modal title={manage?'manageMarkups':'keywordMarkup'} wide className="markup-dialog" onClose={()=>{if(!busy)onClose()}}>
  <div className="markup-body"><p>{t(manage?'manageMarkupsHint':'markupHint')}</p>
   {manage?<>
    <div className="markup-selection"><button disabled={busy||checking||!items.length} onClick={()=>setSelected(new Set(items.map(a=>a.xref)))}>{t('selectAll')}</button><button disabled={busy||!selected.size} onClick={()=>setSelected(new Set())}>{t('clearSelection')}</button><span>{t('markupSelected',{count:selected.size})}</span></div>
    <div className="markup-table"><table><thead><tr><th>{t('markupSelect')}</th><th>{t('page')}</th><th>{t('markupStyle')}</th><th>{t('markupKeyword')}</th></tr></thead><tbody>{items.map(a=><tr key={a.xref} data-markup-id={a.xref}><td><input type="checkbox" disabled={busy} aria-label={t('markupSelectItem',{page:a.page+1,style:t('markup.'+a.style),text:a.text})} checked={selected.has(a.xref)} onChange={()=>setSelected(previous=>{const next=new Set(previous);next.has(a.xref)?next.delete(a.xref):next.add(a.xref);return next})}/></td><td>{a.page+1}</td><td>{t('markup.'+a.style)}</td><td>{a.text}</td></tr>)}</tbody></table></div>
    {!checking&&!items.length&&<p role="status">{t('markupEmpty')}</p>}{selected.size>2000&&<p role="alert">{t('error.markupLimit')}</p>}
   </>:<>
    <fieldset disabled={busy} className="markup-fields"><label>{t('markupKeyword')}<input aria-label={t('markupKeyword')} value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} autoFocus/></label><label>{t('pageRange')}<input aria-label={t('pageRange')} aria-invalid={!valid} value={range} onChange={e=>setRange(e.target.value)}/></label>
    <label>{t('markupStyle')}<select aria-label={t('markupStyle')} value={style} onChange={e=>{setStyle(e.target.value);setColor(e.target.value==='highlight'?'#ffe066':'#d6334c');setOpacity(e.target.value==='highlight'?.45:1)}}>{['highlight','underline','strikeout'].map(k=><option key={k} value={k}>{t('markup.'+k)}</option>)}</select></label><label>{t('markupColor')}<input type="color" aria-label={t('markupColor')} value={color} onChange={e=>setColor(e.target.value)}/></label><label>{t('markupOpacity',{value:Math.round(opacity*100)})}<input type="range" aria-label={t('opacity')} min={.1} max={1} step={.05} value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label></fieldset>
    {!valid&&<p role="alert">{t('error.pageRangeInvalid',{total:doc.pages.length})}</p>}
    {plan&&<><p role="status">{t('markupPlanSummary',{count:plan.total,duplicates:plan.duplicates})}</p><div className="markup-table"><table><thead><tr><th>{t('page')}</th><th>{t('markupNewRegions')}</th><th>{t('markupExisting')}</th></tr></thead><tbody>{plan.pages.map(p=><tr key={p.page} data-markup-page={p.page+1}><td>{p.page+1}</td><td>{p.count}</td><td>{p.duplicates}</td></tr>)}</tbody></table></div>{!plan.total&&<p>{t(plan.duplicates?'markupAllMarked':'markupNoMatches')}</p>}</>}
    <p className="hint">{t('markupSearchHint')}</p>
   </>}
   {checking&&<p role="status">{t('markupChecking')}</p>}{busy&&<p role="status">{t('busy')}</p>}{error&&<p role="alert" className="error">{error}</p>}
  </div>
  <footer><button disabled={busy} onClick={onClose}>{t('cancel')}</button>{!manage&&<button disabled={busy||checking||!plan||plan.key!==key||!plan.total} onClick={()=>submit(true)}>{t('optionalPreview')}</button>}<button className={manage?'danger':'primary'} disabled={busy||checking||(manage?!selected.size||selected.size>2000:!plan||plan.key!==key||!plan.total)} onClick={()=>submit()}>{t(manage?'markupRemove':'apply')}</button></footer>
 </Modal>;
}
