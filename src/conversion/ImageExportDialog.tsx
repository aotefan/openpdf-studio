import {useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal} from '../ui/primitives';
import {parsePageRange} from '../pdf/pageSelection';
import {api} from '../pdf/api';
import type {Doc} from '../types';
import ImageDpiSelect from './ImageDpiSelect';

export default function ImageExportDialog({doc,onClose,onSaved}:{doc:Doc;onClose:()=>void;onSaved:()=>void}){
 const {t}=useTranslation();
 const [dpi,setDpi]=useState(300),[range,setRange]=useState(doc.pages.length===1?'1':`1-${doc.pages.length}`);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 let pages:number[]=[],valid=true;
 try{pages=parsePageRange(range,doc.pages.length);valid=pages.length>0}catch{valid=false}
 const first=doc.pages[pages[0]];
 const exportImages=async()=>{
  if(lock.current||!valid)return;
  lock.current=true;setBusy(true);setError('');
  try{
   const result=await api.export(doc.id,'png',pages,dpi);
   if(await window.studio.save(result)){onSaved();onClose()}
  }catch(e){setError(t('error.'+(String(e).split(': ').pop()||'operationFailed'),{defaultValue:t('error.operationFailed')}))}
  finally{lock.current=false;setBusy(false)}
 };
 return <Modal title="exportImages" onClose={()=>{if(!lock.current)onClose()}}>
  <fieldset className="dialog-body action-fields" disabled={busy} aria-busy={busy}>
   <ImageDpiSelect value={dpi} onChange={setDpi}/>
   <label>{t('pageRange')}<input aria-label={t('pageRange')} aria-invalid={!valid} value={range} onChange={e=>setRange(e.target.value)} placeholder={t('pageRangeExample')}/></label>
   {valid&&first?<p role="status">{t('imageExportSize',{page:pages[0]+1,width:Math.ceil(first.width*dpi/72),height:Math.ceil(first.height*dpi/72),count:pages.length})}</p>:<p role="alert" className="error">{t('error.pageRangeInvalid',{total:doc.pages.length})}</p>}
   <p className="hint">{t('imageExportHint')}</p>
   {error&&<p role="alert" className="error">{error}</p>}
   {busy&&<p role="status">{t('imageExportBusy')}</p>}
  </fieldset>
  <footer><button disabled={busy} onClick={onClose}>{t('cancel')}</button><button disabled={busy||!valid} className="primary" onClick={exportImages}>{t('exportImages')}</button></footer>
 </Modal>;
}
