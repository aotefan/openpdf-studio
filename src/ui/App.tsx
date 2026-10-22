import type {TextPlacementHandle} from '../editor/TextPlacement';
import MarkupDialog from '../annotations/MarkupDialog';
import BatchConversionDialog from '../conversion/BatchConversionDialog';
import OcrDialog from '../ocr/OcrDialog';
import PageManager from './PageManager';
import {MIN_ZOOM,MAX_ZOOM,clampZoom} from './usePinchZoom';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Highlighter,Underline,Strikethrough,ListChecks,FolderOpen,Save,Undo2,Redo2,Search,FileText,Image as ImageIcon,Type,ScanText,RotateCw,Combine,Split,FileOutput,Plus,Trash2,ArrowLeft,ArrowRight,Hash,Droplets,PanelTop,Scaling,Languages,Settings,HelpCircle,ChevronLeft,ChevronRight,Minus,Maximize,BookOpen,Grid2X2,X,ShieldCheck,Sparkles,Replace,Download,FileInput,FileSpreadsheet,Presentation,AlignLeft} from 'lucide-react';
import {api} from '../pdf/api';import type {Doc,FileData,Objects,TextObj,ImgObj,Op,Preview,Rect,TextDraft} from '../types';
import {Tool,Modal} from './primitives';import {Viewer,Thumbnails} from './Viewer';import Inspector from '../editor/Inspector';import PreviewDialog from '../editor/PreviewDialog';import ActionDialog from './ActionDialog';

export default function App(){
 const {t,i18n}=useTranslation();const [docs,setDocs]=useState<Doc[]>([]);const [active,setActive]=useState('');const [page,setPage]=useState(0);const [tab,setTab]=useState('home');const [zoom,setZoom]=useState(.78);const [sidebar,setSidebar]=useState('thumbnails');const [objects,setObjects]=useState<Objects|null>(null);const [text,setText]=useState<TextObj|null>(null);const [image,setImage]=useState<ImgObj|null>(null);const [query,setQuery]=useState('');const [hits,setHits]=useState<{page:number;rect:Rect}[]>([]);const [modal,setModal]=useState('');const [markupStyle,setMarkupStyle]=useState('highlight');const [preview,setPreview]=useState<Preview|null>(null);const [busy,setBusy]=useState(false);const busyRef=useRef(false);const [error,setError]=useState('');const [status,setStatus]=useState('ready');const [saved,setSaved]=useState<Record<string,number>>({});const [recovery,setRecovery]=useState<FileData|null>(null);const searchRef=useRef<HTMLInputElement>(null);const doc=docs.find(d=>d.id===active);const [context,setContext]=useState<{x:number;y:number}|null>(null);
 const [addingText,setAddingText]=useState(false);const placementRef=useRef<TextPlacementHandle>(null);
 const [draft,setDraft]=useState<TextDraft|null>(null);const [caret,setCaret]=useState<number|null>(null);
 // Read the latest session even when a queued navigation callback has an older render.
 const editingRef=useRef({doc,text,draft,page});editingRef.current={doc,text,draft,page};
 const cancelText=()=>{editingRef.current.text=null;editingRef.current.draft=null;setText(null);setDraft(null);setImage(null)};
 const commitText=async(replacement?:string)=>{
  const current=editingRef.current;const {doc:d,text:original,draft:input,page:p}=current;
  if(!d||!original||!input)return;
  const value=replacement===undefined?input:{...input,content:replacement};
  const dirty=value.content!==original.text||value.size!==original.size||value.color!==original.color||value.bold||value.italic||value.underline;
  if(!dirty){cancelText();return}
  const result=await api.preview(d.id,[{type:'replaceText',page:p,id:original.id,expected:original.text,text:value.content,size:value.size,color:value.color,bold:value.bold,italic:value.italic,underline:value.underline}]);
  const changed=await api.commit(d.id,result.token);
  editingRef.current={doc:changed,text:null,draft:null,page:p};update(changed);setDraft(null);setStatus('modified');
 };
 const guard=async(action:()=>unknown)=>{
  if(busyRef.current)return;
  if(placementRef.current&&!await placementRef.current.finish())return;
  if(editingRef.current.text){const ok=await run(()=>commitText());if(!ok)return}
  await action();
 };
 const selectText=(item:TextObj,offset:number|null=null)=>{
  if(editingRef.current.text?.id===item.id)return;
  return guard(()=>run(async()=>{
   const current=editingRef.current;if(!current.doc)return;
   // Rebuilding one span can renumber other spans. Resolve the clicked object again.
   const fresh=await api.objects(current.doc.id,current.page);
   const target=fresh.texts.find(o=>o.text===item.text&&o.rect.every((v,i)=>Math.abs(v-item.rect[i])<.1));
   if(!target)throw new Error('staleObject');
   setObjects(fresh);setText(target);setImage(null);setCaret(offset);
   setDraft({content:target.text,size:target.size,color:target.color,bold:false,italic:false,underline:false});
  }).then(()=>{}));
 };
 const finishText=()=>guard(()=>setImage(null));
 const deleteText=()=>run(()=>commitText(''));
 const report=useCallback((e:unknown)=>{const key=String(e).split(': ').pop()||'operationFailed';setError(i18n.t('error.'+key,{defaultValue:i18n.t('error.operationFailed')}));},[i18n]);
 const run=async(fn:()=>Promise<void>)=>{if(busyRef.current)return false;busyRef.current=true;setBusy(true);setError('');try{await fn();return true}catch(e){report(e);return false}finally{busyRef.current=false;setBusy(false)}};
 // Guarded save/navigation may run before React renders the committed document.
 const update=(d:Doc)=>{if(editingRef.current.doc?.id===d.id)editingRef.current={...editingRef.current,doc:d,text:null,draft:null};setDocs(ds=>ds.map(x=>x.id===d.id?d:x));setPage(p=>Math.min(p,d.pages.length-1));setText(null);setImage(null);setHits([])};
 const openData=async(f:FileData)=>{const d=await window.studio.rpc<Doc>('import_file',f);setDocs(ds=>[...ds,d]);setActive(d.id);setPage(0);setSaved(s=>({...s,[d.id]:0}));setTab('home');setStatus('ready')};
 const open=(kind='pdf')=>guard(()=>run(async()=>{const f=await window.studio.pick(kind);if(f)await openData(f)}));
 const exportFile=(format='pdf',pages?:number[])=>guard(()=>run(async()=>{if(!doc)return;const current=editingRef.current.doc||doc;const data=await api.export(current.id,format,pages);if(await window.studio.save(data)){setStatus('saved');if(format==='pdf'&&!pages)setSaved(s=>({...s,[current.id]:current.revision}))}}));
 const exportSelectedPages=async(pages:number[])=>{let written=false;const ok=await run(async()=>{if(!doc)return;const data=await api.export(doc.id,'pdf',pages);written=await window.studio.save({...data,name:doc.name.replace(/\.pdf$/i,'')+'-'+t('extractedPages')+'.pdf'});if(written)setStatus('saved')});if(!ok)throw new Error('operationFailed');return written};
 const previewOps=(ops:Op[],summary?:string)=>run(async()=>{if(!doc)return;const result=await api.preview(doc.id,ops.map(o=>({page,...o})));setPreview({...result,summary});setModal('');setContext(null)});
 const applyCandidate=(candidate:Preview)=>run(async()=>{const current=editingRef.current.doc;if(!current)return;update(await api.commit(current.id,candidate.token));setModal('');setPreview(null);setContext(null);setStatus('modified')});
 const applyOps=(ops:Op[],nextPage?:number)=>run(async()=>{const current=editingRef.current;if(!current.doc)return;const candidate=await api.preview(current.doc.id,ops.map(o=>({page:current.page,...o})));update(await api.commit(current.doc.id,candidate.token));if(nextPage!==undefined)setPage(nextPage);setModal('');setContext(null);setStatus('modified')});
 const commit=()=>run(async()=>{if(!doc||!preview)return;update(await api.commit(doc.id,preview.token));setPreview(null);setStatus('modified')});
 const history=(direction:string)=>guard(()=>run(async()=>{if(doc)update(await window.studio.rpc<Doc>('history',{sid:doc.id,direction}))}));
 const search=()=>guard(()=>run(async()=>{if(!doc)return;const h=await window.studio.rpc<typeof hits>('search',{sid:doc.id,query});setHits(h);setSidebar('searchResults');if(h.length)setPage(h[0].page)}));
 const pickImage=(replace=false)=>run(async()=>{if(!doc)return;const f=await window.studio.pick('image');if(!f)return;const result=await api.preview(doc.id,[{type:replace?'replaceImage':'insertImage',page,...(replace?{xref:image?.xref}:{}),data:f.data}]);update(await api.commit(doc.id,result.token));setStatus('modified')});
 const transformImage=(rect:Rect)=>run(async()=>{
  if(!doc||!image)return;
  const result=await api.preview(doc.id,[{type:'transformImage',page,xref:image.xref,expectedRect:image.rect,rect}]);
  const updated=await api.commit(doc.id,result.token);update(updated);setStatus('modified');
  const fresh=await api.objects(doc.id,page);setObjects(fresh);setImage(fresh.images.find(o=>o.xref===image.xref)||null);
 });
 const merge=()=>run(async()=>{if(!doc)return;const f=await window.studio.pick('pdf');if(f){const candidate=await api.preview(doc.id,[{type:'merge',data:f.data}]);update(await api.commit(doc.id,candidate.token));setStatus('modified')}});
 const reorder=(delta:number)=>{if(!doc||page+delta<0||page+delta>=doc.pages.length)return;const order=doc.pages.map((_,i)=>i);[order[page],order[page+delta]]=[order[page+delta],order[page]];applyOps([{type:'reorder',order}],page+delta)};
 const closeDoc=()=>guard(()=>run(async()=>{if(!doc)return;await window.studio.rpc('close',{sid:doc.id});setDocs(ds=>ds.filter(d=>d.id!==doc.id));setActive(docs.find(d=>d.id!==doc.id)?.id||'');setPage(0);setModal('')}));
 useEffect(()=>{setObjects(null);if(!doc)return;let live=true;api.objects(doc.id,page).then(r=>{if(live)setObjects(r)}).catch(report);return()=>{live=false}},[active,doc?.revision,page]);
 useEffect(()=>{cancelText()},[active,page]);
 useEffect(()=>{setPage(0);setHits([]);setText(null);setImage(null);setPreview(null)},[active]);
 useEffect(()=>{window.studio.recovery('read').then(setRecovery).catch(report)},[]);
 useEffect(()=>{if(!doc)return;let live=true;const timer=setTimeout(()=>{api.export(doc.id).then(r=>{if(live)return window.studio.recovery('write',{name:doc.name,data:r.data})}).catch(report)},500);return()=>{live=false;clearTimeout(timer)}},[active,doc?.revision]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(!(e.metaKey||e.ctrlKey)||busy||modal||preview)return;const k=e.key.toLowerCase();if((e.target as HTMLElement).matches('input,textarea,[contenteditable=true]')&&k!=='s')return;if(['o','s','z','f'].includes(k))e.preventDefault();if(k==='o')open();if(k==='s'&&doc)exportFile();if(k==='z'&&doc){if(e.shiftKey&&doc.canRedo)history('redo');else if(!e.shiftKey&&doc.canUndo)history('undo')}if(k==='f')searchRef.current?.focus()};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)});
 useEffect(()=>window.studio.onCommand(command=>{
 if(busy||modal||preview)return;
 if(command==='open')open();if(command==='save'&&doc)exportFile();
 if(['undo','redo'].includes(command)&&document.activeElement?.matches('input,textarea,[contenteditable=true]')){document.execCommand(command);return}
 if(command==='undo'&&doc?.canUndo)history('undo');if(command==='redo'&&doc?.canRedo)history('redo');
 if(command==='settings'||command==='help')setModal(command);
 if(command==='search')searchRef.current?.focus();if(command==='fit')fit();
 }));
 const go=(p:number)=>guard(()=>{if(doc)setPage(Math.max(0,Math.min(doc.pages.length-1,p)))});
 const fit=()=>{if(doc)setZoom(Math.min((window.innerWidth-520)/doc.pages[page].width,(window.innerHeight-250)/doc.pages[page].height))};
 const tool=(label:string,icon:any,action:()=>void,disabled=!doc)=> <Tool key={label} label={label} icon={icon} onClick={()=>guard(action)} disabled={disabled||busy}/>;
 return <div className="app" onClick={()=>context&&setContext(null)}>
 <fieldset disabled={busy} className="app-fieldset"><header className="titlebar"><div className="brand"><span className="brand-icon"><FileText size={20}/></span>{t('appName')}</div><div className="file-tabs">{docs.map(d=><div key={d.id} className={'file-tab '+(active===d.id?'active':'')}><button onClick={()=>guard(()=>setActive(d.id))}><FileText size={15}/><span>{d.name}</span>{saved[d.id]!==d.revision&&<span className="dirty-dot"/>}</button>{active===d.id&&<button className="tab-close" aria-label={t('close')} onClick={()=>guard(()=>saved[d.id]!==editingRef.current.doc?.revision?setModal('unsavedClose'):closeDoc())}><X size={13}/></button>}</div>)}<button className="icon-button" title={t('open')} aria-label={t('open')} onClick={()=>open()}><Plus size={17}/></button></div><span className="local-badge"><ShieldCheck size={14}/>{t('local')}</span></header>
 <nav className="menubar"><div className="quick-actions"><button aria-label={t('open')} title={t('open')+' · ⌘O'} onClick={()=>open()}><FolderOpen size={18}/></button><button aria-label={t('save')} title={t('save')+' · ⌘S'} disabled={!doc} onClick={()=>exportFile()}><Save size={18}/></button><span className="divider"/><button aria-label={t('undo')} title={t('undo')+' · ⌘Z'} disabled={!doc?.canUndo} onClick={()=>history('undo')}><Undo2 size={18}/></button><button aria-label={t('redo')} title={t('redo')+' · ⇧⌘Z'} disabled={!doc?.canRedo} onClick={()=>history('redo')}><Redo2 size={18}/></button></div><div className="ribbon-tabs">{['home','edit','annotate','page','convert','batch'].map(k=><button key={k} className={tab===k?'selected':''} onClick={()=>guard(()=>setTab(k))}>{t(k)}</button>)}</div><div className="searchbox"><Search size={16}/><input ref={searchRef} value={query} placeholder={t('search')} aria-label={t('search')} disabled={!doc} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/></div><button className="icon-button" aria-label={t('settings')} title={t('settings')} onClick={()=>setModal('settings')}><Settings size={18}/></button><button className="icon-button" aria-label={t('help')} title={t('help')} onClick={()=>setModal('help')}><HelpCircle size={18}/></button></nav>
 <section className="ribbon" aria-label={t(tab)}>
 {tab==='home'&&<>{tool('open',FolderOpen,()=>open(),false)}{tool('save',Save,()=>exportFile())}<span className="ribbon-divider"/>{tool('editText',FileText,()=>setTab('edit'))}{tool('insertImage',ImageIcon,()=>pickImage())}{tool('ocr',ScanText,()=>setModal('ocr'))}<span className="ribbon-divider"/>{tool('rotate',RotateCw,()=>applyOps([{type:'rotate'}]))}{tool('merge',Combine,merge)}{tool('split',Split,()=>exportFile('split'))}{tool('convert',FileOutput,()=>setModal('convert'))}</>}
 {tab==='edit'&&<>{tool('editText',FileText,()=>{if(objects?.texts[0])selectText(objects.texts[0])})}{tool('editImage',ImageIcon,()=>{setImage(objects?.images[0]||null);setText(null)},!objects?.images.length)}{tool('addText',Type,()=>{cancelText();setAddingText(true)})}{tool('insertImage',ImageIcon,()=>pickImage())}<span className="ribbon-divider"/>{tool('ocr',ScanText,()=>setModal('ocr'))}{tool('watermark',Droplets,()=>setModal('watermark'))}{tool('pageNumbers',Hash,()=>previewOps([{type:'pageNumbers'}]))}{tool('headerFooter',PanelTop,()=>setModal('headerFooter'))}</>}
 {tab==='annotate'&&<>{tool('markup.highlight',Highlighter,()=>{setMarkupStyle('highlight');setModal('markup')})}{tool('markup.underline',Underline,()=>{setMarkupStyle('underline');setModal('markup')})}{tool('markup.strikeout',Strikethrough,()=>{setMarkupStyle('strikeout');setModal('markup')})}<span className="ribbon-divider"/>{tool('manageMarkups',ListChecks,()=>setModal('markupManage'))}</>}
 {tab==='page'&&<>{tool('pageManager',Grid2X2,()=>setModal('pageManager'))}<span className="ribbon-divider"/>{tool('rotate',RotateCw,()=>applyOps([{type:'rotate'}]))}{tool('addPage',Plus,()=>applyOps([{type:'addPage'}]))}{tool('deletePage',Trash2,()=>applyOps([{type:'deletePage'}]),!doc||doc.pages.length===1)}<span className="ribbon-divider"/>{tool('moveLeft',ArrowLeft,()=>reorder(-1),!doc||page===0)}{tool('moveRight',ArrowRight,()=>reorder(1),!doc||page===doc.pages.length-1)}{tool('extract',FileOutput,()=>exportFile('pdf',[page]))}{tool('merge',Combine,merge)}{tool('split',Split,()=>exportFile('split'))}{tool('resize',Scaling,()=>setModal('resize'))}</>}
 {tab==='convert'&&<>{tool('batchConvert',FileOutput,()=>setModal('batchConvert'),false)}{tool('import',FileInput,()=>open('import'),false)}<span className="ribbon-divider"/>{tool('docx',FileText,()=>exportFile('docx'))}{tool('xlsx',FileSpreadsheet,()=>exportFile('xlsx'))}{tool('pptx',Presentation,()=>exportFile('pptx'))}{tool('png',ImageIcon,()=>exportFile('png'))}{tool('txt',AlignLeft,()=>exportFile('txt'))}{tool('compress',Download,()=>exportFile())}</>}
 {tab==='batch'&&<>{tool('keywordMarkup',Highlighter,()=>{setMarkupStyle('highlight');setModal('markup')})}{tool('batchConvert',FileOutput,()=>setModal('batchConvert'),false)}{tool('batchOcr',ScanText,()=>setModal('ocr'))}{tool('batchReplace',Replace,()=>setModal('batch'))}{tool('pageNumbers',Hash,()=>previewOps([{type:'pageNumbers'}]))}{tool('watermark',Droplets,()=>setModal('watermark'))}{tool('split',Split,()=>exportFile('split'))}{tool('log',Download,()=>exportFile('log'))}</>}
 {tab==='ai'&&<>{tool('ai',Sparkles,()=>setModal('ai'))}<p className="ribbon-hint">{t('aiHint')}</p></>}
 </section>
 <main>{doc?<><aside className="sidebar"><div className="sidebar-tabs"><button className={sidebar==='thumbnails'?'selected':''} title={t('thumbnails')} onClick={()=>setSidebar('thumbnails')}><Grid2X2 size={16}/>{t('thumbnails')}</button><button className={sidebar==='bookmarks'?'selected':''} title={t('bookmarks')} onClick={()=>setSidebar('bookmarks')}><BookOpen size={16}/></button></div>{sidebar==='thumbnails'?<Thumbnails doc={doc} page={page} onPage={go} onError={report}/>:sidebar==='bookmarks'?<div className="bookmark-list">{doc.bookmarks.length?doc.bookmarks.map((b,i)=><button key={i} style={{paddingLeft:8+b[0]*8}} onClick={()=>go(b[2]-1)}>{b[1]}</button>):<p>{t('noBookmarks')}</p>}</div>:<div className="search-list"><h4>{t('resultCount',{count:hits.length})}</h4>{hits.map((h,i)=><button key={i} onClick={()=>go(h.page)}>{t('pageLabel',{page:h.page+1,total:doc.pages.length})}<span>{query}</span></button>)}{!hits.length&&<p>{t('noResults')}</p>}</div>}</aside><div className="viewer-region" onContextMenu={e=>{e.preventDefault();setContext({x:Math.min(e.clientX,window.innerWidth-200),y:Math.min(e.clientY,window.innerHeight-160)})}}><Viewer addingText={addingText} placementRef={placementRef} onInsertCancel={()=>setAddingText(false)} onInsertText={async op=>{const ok=await applyOps([op]);if(ok)setAddingText(false);return ok}} doc={doc} page={Math.min(page,doc.pages.length-1)} zoom={zoom} onZoom={setZoom} objects={objects} reading={tab==='home'} editing={tab==='edit'} selection={text?.id||(image?'i'+image.id:'')} text={text} draft={draft} caret={caret} onDraft={value=>{setDraft(value);if(tab==='home')setTab('edit')}} onTextFinish={finishText} onTextCancel={cancelText} image={image} onImageTransform={transformImage} onSelect={(type,o,offset)=>{if(type==='text')selectText(o as TextObj,offset??null);else guard(()=>{setImage(o as ImgObj);setText(null)})}} hits={hits} onError={report}/></div><Inspector key={active+':'+page+':'+doc.revision+':'+(text?.id||'')+':'+(image?.id||'')} text={text} image={image} draft={draft} onDraft={setDraft} onTextDelete={deleteText} preview={applyOps} pickImage={()=>pickImage(true)} editing={tab==='edit'} kind={objects?.kind||'empty'}/></>:<div className="empty"><div className="empty-mark"><FileText size={48} strokeWidth={1.25}/></div><h1>{t('emptyTitle')}</h1><p>{t('emptyBody')}</p><button className="primary" onClick={()=>open()}><FolderOpen size={18}/>{t('open')}</button><button className="subtle" onClick={()=>open('import')}>{t('import')}</button><small>{t('emptyFormats')}</small></div>}</main>
 <footer className="statusbar"><div><ShieldCheck size={14}/><span>{t(status)}</span></div>{doc&&<><div className="page-controls"><button aria-label={t('previous')} disabled={page===0} onClick={()=>go(page-1)}><ChevronLeft size={17}/></button><input aria-label={t('page')} type="number" min={1} max={doc.pages.length} value={page+1} onChange={e=>go(+e.target.value-1)}/><span>/ {doc.pages.length}</span><button aria-label={t('next')} disabled={page===doc.pages.length-1} onClick={()=>go(page+1)}><ChevronRight size={17}/></button></div><div className="zoom-controls"><button title={t('fit')} aria-label={t('fit')} onClick={fit}><Maximize size={16}/></button><button aria-label={t('zoom')+' −'} onClick={()=>setZoom(z=>clampZoom(z-.1))}><Minus size={15}/></button><input type="range" aria-label={t('zoom')} min={MIN_ZOOM} max={MAX_ZOOM} step={.05} value={zoom} onChange={e=>setZoom(+e.target.value)}/><button aria-label={t('zoom')+' +'} onClick={()=>setZoom(z=>clampZoom(z+.1))}><Plus size={15}/></button><span>{Math.round(zoom*100)}%</span></div></>}</footer>
 </fieldset>
 {error&&<div role="alert" className="toast error"><span>{error}</span><button aria-label={t('close')} onClick={()=>setError('')}><X size={16}/></button></div>}{busy&&<div className="busy-mask" role="status"><span className="spinner"/>{t('busy')}</div>}
 {preview&&doc&&<PreviewDialog doc={doc} preview={preview} initialPage={preview.focusPage??page} onApply={commit} onClose={()=>setPreview(null)} onError={report}/>}
 {modal==='settings'&&<Modal title="settings" onClose={()=>setModal('')}><div className="dialog-body"><label><Languages size={16}/>{t('language')}<select aria-label={t('language')} value={i18n.language} onChange={e=>i18n.changeLanguage(e.target.value)}><option value="zh-CN">{t('chinese')}</option><option value="en-US">{t('english')}</option></select></label><p>{t('languageHint')}</p><p className="hint">{t('privacy')}</p></div><footer><button className="primary" onClick={()=>setModal('')}>{t('close')}</button></footer></Modal>}
 {modal==='help'&&<Modal title="help" onClose={()=>setModal('')}><div className="dialog-body"><p>{t('helpBody')}</p><p className="hint">{t('conversionHint')}</p></div></Modal>}
 {modal==='unsavedClose'&&<Modal title="unsavedClose" onClose={()=>setModal('')}><footer><button onClick={()=>setModal('')}>{t('cancel')}</button><button className="danger" onClick={closeDoc}>{t('confirmClose')}</button></footer></Modal>}
 {['markup','markupManage'].includes(modal)&&doc&&<MarkupDialog doc={doc} initialStyle={markupStyle} manage={modal==='markupManage'} onClose={()=>setModal('')} onReady={p=>{setPreview(p);setModal('')}} onApply={applyCandidate}/>}
 {modal==='batchConvert'&&<BatchConversionDialog onClose={()=>setModal('')}/>}
 {modal==='ocr'&&doc&&<OcrDialog doc={doc} page={page} onClose={()=>setModal('')} onReady={result=>{setPreview({...result,summary:t('ocrReadySummary',{count:result.ocrPages?.filter(p=>p.status==='recognized').length||0})});setModal('')}}/>}
 {modal==='pageManager'&&doc&&<PageManager key={doc.id+':'+doc.revision} doc={doc} currentPage={page} onClose={()=>setModal('')} onApply={applyOps} onExport={exportSelectedPages}/>}
 {modal&&!['settings','help','unsavedClose','pageManager','ocr','batchConvert','markup','markupManage'].includes(modal)&&doc&&<ActionDialog kind={modal} doc={doc} onClose={()=>setModal('')} onPreview={previewOps} onApply={applyOps} onExport={exportFile}/>}
 {recovery&&!doc&&<Modal title="recoveryTitle" onClose={()=>setRecovery(null)}><div className="dialog-body"><p>{recovery.name}</p></div><footer><button onClick={()=>{window.studio.recovery('clear');setRecovery(null)}}>{t('discard')}</button><button className="primary" onClick={()=>run(async()=>{await openData(recovery);setRecovery(null)})}>{t('recover')}</button></footer></Modal>}
 {context&&doc&&<div className="context-menu" style={{left:context.x,top:context.y}}>{[['rotate',()=>applyOps([{type:'rotate'}])],['extract',()=>exportFile('pdf',[page])],['editText',()=>setTab('edit')]].map(([label,fn])=><button key={label as string} onClick={()=>guard(fn as ()=>void)}>{t(label as string)}</button>)}</div>}
 </div>
}
