import {execFileSync} from 'node:child_process';
import {expect,_electron as electron} from '@playwright/test';import path from 'node:path';import fs from 'node:fs/promises';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
const root=process.cwd(),exe=process.argv[2]||path.join(root,'release/artifacts.noindex',version,'OpenPDF Studio-darwin-arm64/OpenPDF Studio.app/Contents/MacOS/OpenPDF Studio');
const app=await electron.launch({executablePath:exe,args:['--user-data-dir='+path.join(root,'tests/results/profile-packaged-'+Date.now())]});
const results={executable:exe};
try{
 const page=await app.firstWindow();await page.waitForSelector('.empty');await page.evaluate(()=>localStorage.setItem('language','zh-CN'));await page.reload();
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
 await page.locator('.empty').getByRole('button',{name:'打开 PDF',exact:true}).click();await page.locator('.paper>img').waitFor();results.launch=true;results.open=true;
 const region=await page.locator('.canvas-scroll').boundingBox();const initial=await page.locator('.paper').boundingBox();const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.synthesizePinchGesture',{x:region.x+region.width/2,y:region.y+region.height/2,scaleFactor:1.5,relativeSpeed:600,gestureSourceType:'mouse'});
 await page.waitForFunction(width=>document.querySelector('.paper').getBoundingClientRect().width>width*1.3,initial.width);
 results.pinchZoom=true;
 await page.locator('.text-object').nth(1).click();await expect(page.locator('.ribbon-tabs').getByRole('button',{name:'开始',exact:true})).toHaveClass('selected');await page.getByTestId('text-content').press('End');await page.getByTestId('text-content').pressSequentially('!');await expect(page.locator('.ribbon-tabs').getByRole('button',{name:'编辑',exact:true})).toHaveClass('selected');results.autoTextEdit=true;await page.getByTestId('text-content').fill('Page 1: We must preserve the original layout.');await page.getByTestId('text-content').press('Enter');await page.getByTestId('text-content').waitFor({state:'detached'});await page.getByRole('button',{name:'编辑文字: Page 1: We must preserve the original layout.',exact:true}).waitFor();await page.locator('.paper>img').waitFor();results.edit=true;
 // Mouse-placed text must also work with the bundled worker.
 await page.getByRole('button',{name:'添加文字',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);
 await page.getByTestId('text-placement').click({position:{x:75,y:400}});await page.getByTestId('new-text-input').fill('Packaged mouse text');
 const placedPath=path.join(root,'tests/results/packaged-placed.pdf');await fs.rm(placedPath,{force:true});
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},placedPath);
 await page.getByTestId('new-text-input').press('Meta+s');await expect.poll(async()=>!!await fs.stat(placedPath).catch(()=>null)).toBe(true);await expect(page.locator('.dirty-dot')).toHaveCount(0);
 results.mouseTextPlacement=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'placed.pdf'});try{const o=await window.studio.rpc('objects',{sid:d.id,page:0});if(!o.texts.some(x=>x.text==='Packaged mouse text'))throw new Error('Placed text missing');return true}finally{await window.studio.rpc('close',{sid:d.id})}},await fs.readFile(placedPath,'base64'));
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.getByTestId('new-text-input')).toHaveCount(0);
 const form=await fs.readFile('test-fixtures/cjk-form.pdf','base64');
 results.mixedCjk=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'form.pdf'});const o=await window.studio.rpc('objects',{sid:d.id,page:0});const text='姓名：________某姓名________   ';const p=await window.studio.rpc('preview',{sid:d.id,operations:[{type:'replaceText',page:0,id:o.texts[0].id,text}]});await window.studio.rpc('commit',{sid:d.id,token:p.token});const after=await window.studio.rpc('objects',{sid:d.id,page:0});if(!after.texts.some(x=>x.text.trim()===text.trim()))throw new Error('CJK text missing');return {applied:true,diff:p.diff};},form);
 results.textGrowth=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'growth.pdf'});const o=await window.studio.rpc('objects',{sid:d.id,page:0});const text='姓名：测试输入越来越长，文字区域应该自动向右扩展，完整保留内容。';const layout=await window.studio.rpc('text_layout',{sid:d.id,page:0,id:o.texts[0].id,text});if(layout.width<=300)throw new Error('Layout did not expand');const p=await window.studio.rpc('preview',{sid:d.id,operations:[{type:'replaceText',page:0,id:o.texts[0].id,text}]});await window.studio.rpc('commit',{sid:d.id,token:p.token});const after=await window.studio.rpc('objects',{sid:d.id,page:0});if(!after.texts.some(x=>x.text===text))throw new Error('Expanded text missing');return {width:layout.width,applied:true,diff:p.diff};},form);
 // Exercise the frozen worker's conversion imports, beyond the editable UI smoke.
 const fixture=await fs.readFile('test-fixtures/research.pdf','base64');
 results.conversion=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'fixture.pdf'});const out=[];for(const format of ['docx','xlsx','pptx']){const r=await window.studio.rpc('export',{sid:d.id,format});out.push({format,bytes:r.data.length});}return out;},fixture);
 const scan=await fs.readFile('test-fixtures/scan.pdf','base64');
 results.ocr=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'scan.pdf'});const p=await window.studio.rpc('preview',{sid:d.id,operations:[{type:'ocr'}]});return {changes:p.changes,diff:p.diff};},scan);
 const batchScan=await fs.readFile('test-fixtures/ocr-batch.pdf','base64');
 results.batchOcr=await page.evaluate(async data=>{
  const d=await window.studio.rpc('open',{data,name:'ocr-batch.pdf'});
  try{
   const plan=await window.studio.rpc('ocr_plan',{sid:d.id,pages:[0,1,2,3,4,5]});if(plan.total!==2)throw new Error('OCR plan incorrect');
   let j=await window.studio.rpc('ocr_begin',{sid:d.id,pages:[0,1,2,3,4,5],revision:0});while(!j.done)j=await window.studio.rpc('ocr_step',{job:j.job});
   const p=await window.studio.rpc('ocr_finish',{job:j.job});if(p.diff.length)throw new Error('OCR changed pixels');
   await window.studio.rpc('commit',{sid:d.id,token:p.token});const o=await window.studio.rpc('objects',{sid:d.id,page:0});
   if(!o.texts.some(x=>x.text.includes('中文文字识别测试')))throw new Error('OCR Chinese missing');
   await window.studio.rpc('history',{sid:d.id,direction:'undo'});
   const cancelled=await window.studio.rpc('ocr_begin',{sid:d.id,pages:[0],revision:2});await window.studio.rpc('ocr_cancel',{job:cancelled.job});
   return {recognizedPages:j.completed,diff:p.diff,searchableChinese:true,cancellation:true};
  }finally{await window.studio.rpc('close',{sid:d.id})}
 },batchScan);
 // Page management through the packaged UI, including real extraction.
 await page.locator('.ribbon-tabs').getByRole('button',{name:'页面',exact:true}).click();
 await page.getByRole('button',{name:'页面管理',exact:true}).click();
 await page.getByLabel('页码范围',{exact:true}).fill('1,3');
 if(await page.locator('.managed-page[aria-pressed=true]').count()!==2)throw new Error('Page selection failed');
 const extractedPath=path.join(root,'tests/results/packaged-pages.pdf');await fs.rm(extractedPath,{force:true});
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},extractedPath);
 await page.getByRole('button',{name:'提取为 PDF',exact:true}).click();await page.locator('.page-export-success').waitFor();
 const extracted=await fs.readFile(extractedPath,'base64');
 results.pageExtraction=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'extracted.pdf'});if(d.pages.length!==2)throw new Error('Incorrect extraction count');const o=await window.studio.rpc('objects',{sid:d.id,page:1});if(!o.texts.some(x=>x.text.includes('Page 3:')))throw new Error('Wrong page extracted');await window.studio.rpc('close',{sid:d.id});return true},extracted);
 await page.waitForFunction(()=>document.querySelectorAll('.managed-page img').length===3);
 await page.screenshot({path:'tests/results/packaged-page-manager-zh-CN.png'});
 await page.getByRole('button',{name:'顺时针旋转',exact:true}).click();await expect(page.locator('.comparison')).toHaveCount(0);
 await page.locator('dialog').waitFor({state:'detached'});await page.getByRole('button',{name:'撤销',exact:true}).click();results.pageManagement=true;
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/page-order.pdf'));
 await page.locator('.quick-actions').getByRole('button',{name:'打开 PDF',exact:true}).click();
 await page.locator('.ribbon-tabs').getByRole('button',{name:'页面',exact:true}).click();await page.getByRole('button',{name:'页面管理',exact:true}).click();
 await expect(page.locator('.managed-page img')).toHaveCount(6);
 await page.getByLabel('页码范围',{exact:true}).fill('1,3,5');
 await expect(page.locator('.managed-page[aria-pressed=true]')).toHaveCount(3);
 const target=page.locator('.managed-page[data-source-page="6"]');const targetBox=await target.boundingBox();
 await page.locator('.managed-page[data-source-page="3"]').dragTo(target,{targetPosition:{x:targetBox.width-5,y:40}});
 await page.waitForFunction(()=>[...document.querySelectorAll('.managed-page')].map(e=>e.getAttribute('data-source-page')).join(',')==='2,4,6,1,3,5');
 await page.waitForFunction(()=>document.querySelectorAll('.managed-page img').length===6);
 await page.screenshot({path:'tests/results/packaged-page-order-zh-CN.png'});
 await page.getByRole('button',{name:'应用新页序',exact:true}).click();await expect(page.locator('.comparison')).toHaveCount(0);await page.locator('dialog').waitFor({state:'detached'});
 const reorderedPath=path.join(root,'tests/results/packaged-reordered.pdf');await fs.rm(reorderedPath,{force:true});
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},reorderedPath);
 await page.locator('.quick-actions').getByRole('button',{name:'另存副本',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.statusbar').textContent.includes('副本已保存'));
 const reorderedData=await fs.readFile(reorderedPath,'base64');results.pageReorder=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'reordered.pdf'});const first=await window.studio.rpc('objects',{sid:d.id,page:0});if(d.pages.length!==6||!first.texts.some(x=>x.text==='PAGE 2'))throw new Error('Reorder persistence failed');await window.studio.rpc('close',{sid:d.id});return true},reorderedData);
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/images.pdf'));
 await page.locator('.quick-actions').getByRole('button',{name:'打开 PDF',exact:true}).click();
 await page.locator('.ribbon-tabs').getByRole('button',{name:'编辑',exact:true}).click();
 await page.locator('.image-object').click({position:{x:15,y:15}});await page.getByTestId('image-selection').waitFor();
 const selection=page.getByTestId('image-selection');const old=await selection.boundingBox();
 await page.mouse.move(old.x+old.width/2,old.y+old.height/2);await page.mouse.down();await page.mouse.move(old.x+old.width/2+30,old.y+old.height/2+20,{steps:5});await page.locator('.image-drag-sprite').waitFor();await page.mouse.up();
 await page.locator('.image-drag-sprite').waitFor({state:'detached'});await selection.waitFor();
 await expect.poll(async()=>Math.abs(((await selection.boundingBox())?.x??-999)-old.x-30)).toBeLessThan(1);results.imageDrag=true;
 await page.getByRole('button',{name:'删除图片',exact:true}).click();await expect(page.locator('.image-object')).toHaveCount(0);await expect(page.locator('dialog')).toHaveCount(0);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.locator('.image-object')).toHaveCount(1);results.directImageDeletion=true;
 await page.locator('.paper>img').waitFor();
 await page.screenshot({path:'tests/results/packaged-zh-CN.png'});
 const batchOut=path.join(root,'tests/results/packaged-batch-'+Date.now());await fs.mkdir(batchOut,{recursive:true});
 await app.evaluate(({dialog},{root,batchOut})=>{dialog.showOpenDialog=async(_w,options)=>({canceled:false,filePaths:options.properties.includes('openDirectory')?[batchOut]:[root+'/test-fixtures/research.pdf',root+'/test-fixtures/page-order.pdf']})},{root,batchOut});
 const tabsBefore=await page.locator('.file-tab').count();
 await page.locator('.ribbon-tabs').getByRole('button',{name:'批量处理',exact:true}).click();await page.getByRole('button',{name:'批量转换',exact:true}).click();
 await page.getByRole('button',{name:'选择 PDF 文件',exact:true}).click();await page.getByRole('button',{name:'选择保存文件夹',exact:true}).click();await page.getByLabel('输出格式',{exact:true}).selectOption('txt');
 await page.getByRole('button',{name:'开始批量转换',exact:true}).click();await page.locator('.batch-success').waitFor();
 const resultText=await page.locator('.batch-success').innerText();const folder=resultText.split('\n').slice(1).join('\n');const names=await fs.readdir(folder);
 if(names.length!==2||!(await fs.readFile(path.join(folder,'001-research.txt'),'utf8')).includes('OpenPDF'))throw new Error('Packaged batch conversion failed');
 await page.screenshot({path:'tests/results/packaged-batch-conversion-zh-CN.png'});
 await page.locator('dialog footer').getByRole('button',{name:'关闭',exact:true}).click();if(await page.locator('.file-tab').count()!==tabsBefore)throw new Error('Batch affected editor sessions');
 results.batchConversion={files:names.length,format:'txt',readback:true,editorTabsRetained:true};

 const markupData=await fs.readFile('test-fixtures/markups.pdf','base64');
 results.keywordMarkup=await page.evaluate(async data=>{
  const d=await window.studio.rpc('open',{data,name:'markups.pdf'});
  let reopened;
  try{
   const plan=await window.studio.rpc('markup_plan',{sid:d.id,query:'合同',pages:[0,1,2,3],style:'highlight'});
   if(plan.total!==8)throw new Error('Markup plan incorrect');
   const preview=await window.studio.rpc('preview',{sid:d.id,operations:plan.operations});
   if(!preview.markupValidated||preview.diff.some(x=>!x.outsideExact))throw new Error('Markup integrity failed');
   await window.studio.rpc('commit',{sid:d.id,token:preview.token});
   const saved=await window.studio.rpc('export',{sid:d.id,format:'pdf'});
   reopened=await window.studio.rpc('open',{data:saved.data,name:'saved-markups.pdf'});
   const rows=await window.studio.rpc('markups',{sid:reopened.id});
   if(rows.items.length!==8)throw new Error('Markups missing after reopen');
   const removal=await window.studio.rpc('preview',{sid:reopened.id,operations:rows.items.map(a=>({type:'deleteMarkup',page:a.page,xref:a.xref,id:a.id,revision:rows.revision}))});
   await window.studio.rpc('commit',{sid:reopened.id,token:removal.token});
   if((await window.studio.rpc('markups',{sid:reopened.id})).items.length)throw new Error('Removal failed');
   await window.studio.rpc('history',{sid:reopened.id,direction:'undo'});
   if((await window.studio.rpc('markups',{sid:reopened.id})).items.length!==8)throw new Error('Undo failed');
   return {regions:plan.total,baseContentVerified:true,diff:preview.diff,reopened:true,removed:true,undo:true};
  }finally{await window.studio.rpc('close',{sid:d.id});if(reopened)await window.studio.rpc('close',{sid:reopened.id})}
 },markupData);
 await page.locator('.ribbon-tabs').getByRole('button',{name:'批注',exact:true}).click();
 await page.getByRole('button',{name:'高亮',exact:true}).click();await page.getByLabel('关键词',{exact:true}).fill('absent');
 await page.getByText('所选范围没有找到文字。扫描件请先执行文字识别。',{exact:true}).waitFor();
 await page.screenshot({path:'tests/results/packaged-keyword-markup-zh-CN.png'});
 await page.locator('dialog footer').getByRole('button',{name:'取消',exact:true}).click();

}catch(error){try{const page=await app.firstWindow();await page.screenshot({path:'tests/results/packaged-failure.png'});results.failure={message:String(error),order:await page.locator('.managed-page').evaluateAll(es=>es.map(e=>e.getAttribute('data-source-page')))};}catch{}throw error;}finally{await app.close();const bundle=exe.slice(0,exe.indexOf('.app/')+4);if(bundle.includes('/release/')||bundle.includes('/openpdf-portable-')){try{execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-u',bundle])}catch{}}await fs.writeFile('tests/results/packaged-smoke.json',JSON.stringify(results,null,2));}
