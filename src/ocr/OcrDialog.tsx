import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal} from '../ui/primitives';
import {parsePageRange} from '../pdf/pageSelection';
import type {Doc,OcrPlan,OcrProgress,Preview} from '../types';
import OcrResults from './OcrResults';

export default function OcrDialog({doc,page,onClose,onReady}:{doc:Doc;page:number;onClose:()=>void;onReady:(p:Preview)=>void}){
 const {t}=useTranslation();const [range,setRange]=useState(doc.pages.length===1?'1':`1-${doc.pages.length}`);
 const [plan,setPlan]=useState<(OcrPlan&{range:string})|null>(null);const [progress,setProgress]=useState<OcrProgress|null>(null);
 const [checking,setChecking]=useState(true);const [busy,setBusy]=useState(false);const [cancelling,setCancelling]=useState(false);const [error,setError]=useState('');const [cancelled,setCancelled]=useState(false);
 const jobRef=useRef<string|null>(null),cancelRef=useRef(false),running=useRef(false);
 let pages:number[]=[],valid=true;try{pages=parsePageRange(range,doc.pages.length)}catch{valid=false}
 useEffect(()=>{
  let live=true;setPlan(null);setProgress(null);setError('');setCancelled(false);setChecking(true);
  if(!valid||!pages.length){setChecking(false);return}
  const timer=setTimeout(()=>window.studio.rpc<OcrPlan>('ocr_plan',{sid:doc.id,pages})
   .then(result=>{if(live)setPlan({...result,range})}).catch(e=>{if(live)setError(errorText(e))}).finally(()=>{if(live)setChecking(false)}),120);
  return()=>{live=false;clearTimeout(timer)};
 },[doc.id,doc.revision,range]);
 useEffect(()=>()=>{cancelRef.current=true;if(jobRef.current)window.studio.rpc('ocr_cancel',{job:jobRef.current}).catch(()=>{})},[]);
 const errorText=(e:unknown)=>t('error.'+(String(e).split(': ').pop()||'operationFailed'),{defaultValue:t('error.operationFailed')});
 const requestCancel=()=>{cancelRef.current=true;setCancelling(true)};
 const start=async()=>{
  if(running.current||!plan||plan.range!==range||checking||!plan.total)return;
  running.current=true;cancelRef.current=false;setBusy(true);setCancelling(false);setCancelled(false);setError('');let ready=false;
  try{
   let step=await window.studio.rpc<OcrProgress>('ocr_begin',{sid:doc.id,pages,revision:doc.revision});jobRef.current=step.job;setProgress(step);
   while(!step.done&&!cancelRef.current){step=await window.studio.rpc<OcrProgress>('ocr_step',{job:step.job});setProgress(step)}
   if(cancelRef.current){setCancelled(true);setProgress(null);return}
   const preview=await window.studio.rpc<Preview>('ocr_finish',{job:step.job});
   if(cancelRef.current){setCancelled(true);setProgress(null);return}
   ready=true;jobRef.current=null;onReady(preview);
  }catch(e){setError(errorText(e))}
  finally{
   if(jobRef.current&&!ready)await window.studio.rpc('ocr_cancel',{job:jobRef.current}).catch(()=>{});
   jobRef.current=null;running.current=false;setBusy(false);setCancelling(false);
  }
 };
 return <Modal title="batchOcr" wide onClose={()=>{if(busy)requestCancel();else onClose()}}>
  <div className="ocr-dialog-body">
   <p>{t('batchOcrHint')}</p>
   <fieldset disabled={busy} className="ocr-controls"><label>{t('pageRange')}<input aria-label={t('pageRange')} aria-invalid={!valid} value={range} onChange={e=>setRange(e.target.value)} placeholder={t('pageRangeExample')}/></label><button onClick={()=>setRange(String(page+1))}>{t('ocrCurrentPage')}</button><button onClick={()=>setRange(doc.pages.length===1?'1':`1-${doc.pages.length}`)}>{t('ocrAllPages')}</button></fieldset>
   {!valid&&<p role="alert" className="error">{t('error.pageRangeInvalid',{total:doc.pages.length})}</p>}
   {checking&&<p role="status">{t('ocrInspecting')}</p>}
   {plan&&<p>{t('ocrPlanSummary',{eligible:plan.total,skipped:plan.pages.length-plan.total})}</p>}
   {plan&&!plan.total&&<p role="status">{t('error.ocrNoEligible')}</p>}
   {busy&&<div className="ocr-progress" role="status"><progress max={progress?.total||1} value={progress?.completed||0}/><span>{t(cancelling?'ocrCancelling':'ocrProgress',{done:progress?.completed||0,total:progress?.total||plan?.total||0})}</span></div>}
   {cancelled&&<p role="status">{t('ocrCancelled')}</p>}
   {error&&<p role="alert" className="error">{error}</p>}
   {(progress||plan)&&<OcrResults pages={(progress||plan)!.pages}/>}
   <p className="hint">{t('ocrLimitHint')}</p>
  </div>
  <footer>{busy?<button disabled={cancelling} onClick={requestCancel}>{t('ocrCancel')}</button>:<><button onClick={onClose}>{t('close')}</button><button className="primary" disabled={checking||!valid||!plan||plan.range!==range||!plan.total} onClick={start}>{t('ocrStart')}</button></>}</footer>
 </Modal>;
}
