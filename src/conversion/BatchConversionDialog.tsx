import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal} from '../ui/primitives';
import type {BatchConversionState} from '../types';
export default function BatchConversionDialog({onClose}:{onClose:()=>void}){
 const {t}=useTranslation();const [state,setState]=useState<BatchConversionState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),locked=useRef(false),cancel=useRef(false);
 const message=(e:unknown)=>t('error.'+(String(e).split(': ').pop()||'operationFailed'),{defaultValue:t('error.operationFailed')});
 useEffect(()=>{alive.current=true;window.studio.batch('reset').then(s=>{if(alive.current)setState(s)}).catch(e=>{if(alive.current)setError(message(e))});return()=>{alive.current=false;cancel.current=true;window.studio.batch('cancel').catch(()=>{})}},[]);
 const action=async(name:string,value?:string)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');
  try{const result=await window.studio.batch(name,value);if(alive.current)setState(result)}catch(e){if(alive.current)setError(message(e))}finally{locked.current=false;if(alive.current)setBusy(false)}
 };
 const run=async()=>{
  if(locked.current)return;locked.current=true;cancel.current=false;setBusy(true);setError('');
  try{
   let result=await window.studio.batch('begin');if(alive.current)setState(result);
   while(result.phase==='running'&&!cancel.current){result=await window.studio.batch('step');if(alive.current)setState(result)}
   if(cancel.current){result=await window.studio.batch('cancel')}
   else if(result.phase==='prepared')result=await window.studio.batch('finish');
   if(alive.current)setState(result);
  }catch(e){await window.studio.batch('cancel').catch(()=>{});if(alive.current)setError(message(e))}
  finally{locked.current=false;if(alive.current)setBusy(false)}
 };
 const requestCancel=()=>{cancel.current=true;window.studio.batch('cancel').then(s=>{if(alive.current)setState(s)}).catch(e=>{if(alive.current)setError(message(e))})};
 const running=busy&&!!state&&['running','cancelling','prepared'].includes(state.phase);
 return <Modal title="batchConvert" wide className="batch-conversion" onClose={()=>{if(running)requestCancel();else if(!busy)onClose()}}>
  <div className="batch-conversion-body">
   <p>{t('batchConvertHint')}</p>
   <fieldset disabled={busy||!state} className="batch-conversion-controls">
    <button onClick={()=>action('files')}>{t('batchChooseFiles')}</button>
    <label>{t('batchOutputFormat')}<select aria-label={t('batchOutputFormat')} value={state?.format||'docx'} onChange={e=>action('format',e.target.value)}>{['docx','xlsx','pptx','png','txt'].map(f=><option key={f} value={f}>{t(f)}</option>)}</select></label>
    <button onClick={()=>action('folder')}>{t('batchChooseFolder')}</button>
   </fieldset>
   <p className="batch-destination">{t('batchDestination')}: {state?.destination||t('batchNoFolder')}</p>
   <details className="batch-limits"><summary>{t('batchLimits')}</summary><p className="hint">{t('batchFormatHint')} {t('batchScanHint')}</p></details>
   <div className="batch-files"><table><thead><tr><th>{t('batchSource')}</th><th>{t('batchOutput')}</th><th>{t('batchStatus')}</th></tr></thead><tbody>{state?.files.map((file,i)=><tr key={i} data-batch-file={i}><td>{file.name}<small>{t('batchFileSize',{size:(file.size/1024).toFixed(1)})}</small></td><td>{file.output}</td><td>{t('batchFile.'+(state.phase==='complete'?'saved':state.phase==='cancelled'||state.phase==='failed'?'discarded':file.status))}</td></tr>)}</tbody></table>{!state?.files.length&&<p className="batch-empty">{t('batchNoFiles')}</p>}</div>
   {state?.files.length&&state.phase!=='complete'? <p>{t('batchSummary',{count:state.files.length,format:t(state.format)})}</p>:null}
   {running&&<div className="ocr-progress" role="status"><progress max={state.files.length||1} value={state.completed}/><span>{t(state.phase==='cancelling'?'batchCancelling':'batchProgress',{done:state.completed,total:state.files.length})}</span></div>}
   {state?.phase==='cancelled'&&<p role="status">{t('batchCancelled')}</p>}
   {state?.phase==='failed'&&<p role="alert" className="error">{t('batchFailed',{file:state.failedFile})} {t('error.'+state.error,{defaultValue:t('error.operationFailed')})}</p>}
   {state?.phase==='complete'&&<p role="status" className="batch-success">{t('batchSaved',{count:state.files.length})}<br/>{state.result}</p>}
   {error&&<p role="alert" className="error">{error}</p>}
  </div>
  <footer>{running?<button disabled={state?.phase==='cancelling'} onClick={requestCancel}>{t('batchCancel')}</button>:<><button disabled={busy} onClick={onClose}>{t('close')}</button>{state?.phase==='complete'?<button disabled={busy} className="primary" onClick={()=>action('reveal')}>{t('batchReveal')}</button>:<button disabled={busy||!state?.files.length||!state.destination} className="primary" onClick={run}>{t('batchStart')}</button>}</>}</footer>
 </Modal>;
}
