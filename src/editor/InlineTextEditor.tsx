import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import type {Doc,TextObj,TextDraft} from '../types';

export default function InlineTextEditor({doc,page,text,draft,zoom,caret,onChange,onFinish,onCancel,onError,passive=false}:{
 doc:Doc;page:number;text:TextObj;draft:TextDraft;zoom:number;caret:number|null;
 onChange:(draft:TextDraft)=>void;onFinish:()=>void;onCancel:()=>void;onError:(e:unknown)=>void;passive?:boolean;
}){
 const {t}=useTranslation(); const input=useRef<HTMLTextAreaElement>(null);
 const [measuredWidth,setMeasuredWidth]=useState(0);const [background,setBackground]=useState(''); const [failed,setFailed]=useState(false);
 const [selection,setSelection]=useState<[number,number]>([0,0]); const composing=useRef(false);
 // Keep the same scale while typing so zoom changes do not reset the caret or IME.
 useEffect(()=>{
  if(passive)return;
  let live=true;
  window.studio.rpc<{image:string}>('text_backdrop',{sid:doc.id,page,id:text.id,scale:2})
   .then(result=>{if(live)setBackground('data:image/png;base64,'+result.image)})
   .catch(error=>{if(live){setFailed(true);onError(error)}});
  return()=>{live=false};
 },[doc.id,doc.revision,page,text.id,passive]);
 const family=/simsun|song|serif|times/i.test(text.font)?'"Songti SC", "Times New Roman", serif':/courier|mono/i.test(text.font)?'monospace':'Arial, "PingFang SC", sans-serif';
 const weight=draft.bold||/bold/i.test(text.font)?'bold':'normal';
 const italic=draft.italic||/italic|oblique/i.test(text.font)?'italic':'normal';
 // Browser measurements keep IME input responsive. Engine metrics catch
 // narrower browser fallback fonts; stale replies cannot resize a newer draft.
 const browserWidth=useMemo(()=>{
  const ctx=document.createElement('canvas').getContext('2d');if(!ctx)return 0;
  ctx.font=`${italic} ${weight} ${draft.size}px ${family}`;return ctx.measureText(draft.content).width;
 },[draft.content,draft.size,family,weight,italic]);
 useEffect(()=>{
  let live=true;setMeasuredWidth(0);
  const timer=setTimeout(()=>window.studio.rpc<{width:number}>('text_layout',{sid:doc.id,page,id:text.id,text:draft.content,size:draft.size,bold:draft.bold,italic:draft.italic})
   .then(r=>{if(live)setMeasuredWidth(r.width)}).catch(()=>{}),60);
  return()=>{live=false;clearTimeout(timer)};
 },[doc.id,doc.revision,page,text.id,draft.content,draft.size,draft.bold,draft.italic]);
 useLayoutEffect(()=>{
  if(!input.current)return;
  input.current.focus({preventScroll:true});
  let index=draft.content.length;
  if(caret!==null){
   const ctx=document.createElement('canvas').getContext('2d');
   if(ctx){ctx.font=`${italic} ${weight} ${draft.size*zoom}px ${family}`;
    let prior=0;index=0;
    for(const char of draft.content){const end=index+char.length;const width=ctx.measureText(draft.content.slice(0,end)).width;
     if(caret*zoom<(prior+width)/2)break;index=end;prior=width;
    }
   }
  }
  input.current.setSelectionRange(index,index);setSelection([index,index]);
 },[text.id]);
 const rect=text.viewRect;const width=Math.max(4,Math.min(doc.pages[page].width-rect[0],Math.max(rect[2]-rect[0],browserWidth+2,measuredWidth+2))*zoom);
 const height=Math.max((rect[3]-rect[1])*zoom,draft.size*zoom*1.2);
 const top=rect[1]*zoom;const left=rect[0]*zoom;
 // Only editing pixels use a browser substitute font; the committed and saved PDF
 // always come from the PDF engine. The backdrop removes glyphs, never vectors/images.
 return <>
  {background&&!passive&&<img className="inline-backdrop" src={background} alt="" draggable={false}/>}
  {!passive&&!background&&!failed&&<span role="status" className="inline-loading" style={{left,top:top+height+5}}>{t('busy')}</span>}
  <>
   <textarea ref={input} className={'inline-text-input'+(passive?' reading-caret':'')} data-testid="text-content" aria-label={t('inlineEdit')} readOnly={failed}
    aria-describedby="inline-help" value={draft.content} spellCheck={false} wrap="off"
    style={{left,top,width,height,fontSize:draft.size*zoom,fontFamily:family,fontWeight:weight,fontStyle:italic,
     color:passive||!background?'transparent':draft.color,caretColor:draft.color,lineHeight:`${height}px`,textDecoration:draft.underline?'underline':'none'}}
    onChange={e=>onChange({...draft,content:e.target.value})}
    onSelect={e=>setSelection([e.currentTarget.selectionStart,e.currentTarget.selectionEnd])}
    onCompositionStart={()=>{composing.current=true}}
    onCompositionEnd={()=>{composing.current=false}}
    onKeyDown={e=>{
     if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s')return;
     e.stopPropagation();
     if(composing.current||e.nativeEvent.isComposing||e.keyCode===229)return;
     if(e.key==='Enter'){e.preventDefault();onFinish()}
     if(e.key==='Escape'){e.preventDefault();onCancel()}
    }}/>
   <span id="inline-help" className="sr-only">{t('inlineKeys')}</span>
   <span className="sr-only" aria-live="polite">{t('inlineSelection',{count:selection[1]-selection[0]})}</span>
  </>
 </>;
}
