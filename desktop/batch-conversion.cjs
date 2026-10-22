const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const formats=new Set(['docx','xlsx','pptx','png','txt']);
class BatchConversion {
 constructor(call){this.call=call;this.reset()}
 reset(){if(this.busy||this.stage)throw new Error('batchBusy');this.files=[];this.destination='';this.format='docx';this.phase='ready';this.completed=0;this.error='';this.failedFile='';this.result='';this.cancelled=false;return this.status()}
 status(){return {files:this.files.map(({name,size},i)=>({name,size,output:`${String(i+1).padStart(3,'0')}-${name.replace(/\.pdf$/i,'')}.${this.format==='png'?'zip':this.format}`,status:i<this.completed?'converted':i===this.completed&&this.phase==='running'?'converting':'pending'})),destination:this.destination,format:this.format,phase:this.phase,completed:this.completed,error:this.error,failedFile:this.failedFile,result:this.result}}
 async configure({files,destination,format}={}){
  if(this.busy||this.stage)throw new Error('batchBusy');
  if(format!==undefined&&!formats.has(format))throw new Error('invalidOperation');
  let items=this.files;
  if(files!==undefined){
   if(!Array.isArray(files)||!files.length||files.length>30)throw new Error('batchFileLimit');
   items=[];const seen=new Set();let total=0;
   for(const file of files){
    const real=await fs.realpath(file);if(seen.has(real))continue;seen.add(real);
    const s=await fs.stat(real);if(!s.isFile()||path.extname(real).toLowerCase()!=='.pdf')throw new Error('invalidFile');
    if(s.size>60*1024*1024)throw new Error('fileTooLarge');total+=s.size;
    if(total>600*1024*1024)throw new Error('batchFileLimit');
    // Read from a descriptor and revalidate this identity before conversion.
    items.push({path:real,name:path.basename(real),size:s.size,mtime:s.mtimeMs,ino:s.ino,dev:s.dev});
   }
  }
  if(destination!==undefined){destination=await fs.realpath(destination);if(!(await fs.stat(destination)).isDirectory())throw new Error('invalidOperation')}
  this.files=items;if(destination!==undefined)this.destination=destination;if(format!==undefined)this.format=format;
  this.phase='ready';this.completed=0;this.error='';this.failedFile='';this.result='';return this.status();
 }
 async begin(){
  if(this.busy||this.stage)throw new Error('batchBusy');
  if(!this.files.length||!this.destination)throw new Error('batchSelectionRequired');
  this.busy=true;this.cancelled=false;this.completed=0;this.error='';this.failedFile='';this.result='';
  try{this.stage=await fs.mkdtemp(path.join(this.destination,'.openpdf-batch-'));this.phase='running';if(this.cancelled)await this.discard('cancelled');return this.status()}
  catch(e){await this.fail(e);return this.status()}finally{this.busy=false}
 }
 async discard(phase){if(this.stage){await fs.rm(this.stage,{recursive:true,force:true});this.stage=null}this.phase=phase}
 async fail(e){this.error=['ENOSPC','EACCES','EPERM','ENOENT'].includes(e.code)?'batchWriteFailed':e.message||'operationFailed';await this.discard(this.cancelled?'cancelled':'failed')}
 async cancel(){this.cancelled=true;if(this.busy){this.phase='cancelling';return this.status()}if(this.stage)await this.discard('cancelled');return this.status()}
 async step(){
  if(this.busy)throw new Error('batchBusy');if(this.phase!=='running'||!this.stage)throw new Error('batchNotRunning');
  this.busy=true;let sid;const file=this.files[this.completed];
  try{
   this.failedFile=file.name;
   const handle=await fs.open(file.path,'r');let raw;
   try{const s=await handle.stat();if(s.size!==file.size||s.mtimeMs!==file.mtime||s.ino!==file.ino||s.dev!==file.dev)throw new Error('batchSourceChanged');raw=await handle.readFile();const end=await handle.stat();if(end.size!==s.size||end.mtimeMs!==s.mtimeMs)throw new Error('batchSourceChanged')}finally{await handle.close()}
   if(this.cancelled){await this.discard('cancelled');return this.status()}
   const d=await this.call('open',{data:raw.toString('base64'),name:file.name});sid=d.id;
   if(['docx','xlsx','txt'].includes(this.format)){
    const info=await this.call('conversion_info',{sid});if(info.imageOnlyPages>0)throw new Error('batchNeedsOcr');
   }
   if(this.cancelled){await this.discard('cancelled');return this.status()}
   const result=await this.call('export',{sid,format:this.format});
   if(this.cancelled){await this.discard('cancelled');return this.status()}
   if(typeof result.data!=='string'||result.data.length>250*1024*1024)throw new Error('fileTooLarge');
   await fs.writeFile(path.join(this.stage,this.status().files[this.completed].output),Buffer.from(result.data,'base64'),{flag:'wx'});
   if(this.cancelled){await this.discard('cancelled');return this.status()}
   this.completed++;this.failedFile='';if(this.completed===this.files.length)this.phase='prepared';return this.status();
  }catch(e){await this.fail(e);return this.status()}
  finally{if(sid)await this.call('close',{sid}).catch(()=>{});this.busy=false}
 }
 async finish(){
  if(this.busy)throw new Error('batchBusy');if(this.phase!=='prepared'||!this.stage)throw new Error('batchNotRunning');
  this.busy=true;
  try{
   if(this.cancelled){await this.discard('cancelled');return this.status()}
   const result=path.join(this.destination,'OpenPDF-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
   // Unique destination; refuse any existing entry, including symbolic links.
   try{await fs.lstat(result);throw new Error('batchDestinationExists')}catch(e){if(e.code!=='ENOENT')throw e}
   if(this.cancelled){await this.discard('cancelled');return this.status()}
   await fs.rename(this.stage,result);this.stage=null;this.result=result;this.phase='complete';return this.status();
  }catch(e){await this.fail(e);return this.status()}finally{this.busy=false}
 }
}
module.exports={BatchConversion};
