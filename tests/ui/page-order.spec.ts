import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';
for(const locale of ['zh-CN','en-US'])test(`${locale}: drag selected pages, cancel, apply, save and undo`,async()=>{
 const root=path.resolve('.'),zh=locale==='zh-CN';const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-order-'+locale+'-'+Date.now())]});const errors:string[]=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await expect(page).toHaveTitle('OpenPDF Studio');await page.waitForSelector('.empty');
  await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();await page.waitForSelector('.empty');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/page-order.pdf'));
  await page.locator('.empty').getByRole('button',{name:zh?'打开 PDF':'Open PDF',exact:true}).click();await expect(page.locator('.paper>img')).toBeVisible();
  await page.locator('.ribbon-tabs').getByRole('button',{name:zh?'页面':'Page',exact:true}).click();
  const dialog=page.locator('dialog'),range=page.getByLabel(zh?'页码范围':'Page range',{exact:true});
  const open=async()=>{await page.getByRole('button',{name:zh?'页面管理':'Manage pages',exact:true}).click();await expect(page.locator('.managed-page')).toHaveCount(6)};
  const sequence=()=>page.locator('.managed-page').evaluateAll(es=>es.map(e=>Number(e.getAttribute('data-source-page'))));
  const card=(n:number)=>page.locator(`.managed-page[data-source-page="${n}"]`);
  const drag=async(from:number,to:number,after=true)=>{const box=(await card(to).boundingBox())!;await card(from).dragTo(card(to),{targetPosition:{x:after?box.width-5:5,y:40}})};
  const preview=()=>dialog.getByRole('button',{name:zh?'应用新页序':'Apply new order',exact:true}).click();
  const reset=()=>dialog.getByRole('button',{name:zh?'还原页序':'Reset order',exact:true}).click();
  await open();await expect(page.locator('.managed-page img')).toHaveCount(6);
  await drag(1,3);await expect.poll(sequence).toEqual([2,3,1,4,5,6]);
  await expect(dialog.getByRole('button',{name:zh?'提取为 PDF':'Extract to PDF',exact:true})).toBeDisabled();
  await reset();await expect.poll(sequence).toEqual([1,2,3,4,5,6]);
  await range.fill('1,3,5');await drag(3,6);await expect.poll(sequence).toEqual([2,4,6,1,3,5]);
  await page.screenshot({path:`tests/results/page-order-${locale}.png`});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));
  await expect.poll(()=>dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await dialog.getByRole('button',{name:zh?'应用新页序':'Apply new order',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`tests/results/page-order-narrow-${locale}.png`});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1496,855));
  await dialog.getByRole('button',{name:zh?'关闭':'Close',exact:true}).click();
  await open();await expect.poll(sequence).toEqual([1,2,3,4,5,6]);
  // Keyboard-accessible movement is available alongside dragging.
  await range.fill('1,3,5');await dialog.getByRole('button',{name:zh?'后移所选页面':'Move selection later',exact:true}).click();await expect.poll(sequence).toEqual([2,1,4,3,6,5]);
  await dialog.getByRole('button',{name:zh?'前移所选页面':'Move selection earlier',exact:true}).click();await expect.poll(sequence).toEqual([1,2,3,4,5,6]);
  await drag(3,6);await expect.poll(sequence).toEqual([2,4,6,1,3,5]);
  await preview();await expect(page.locator('.comparison')).toHaveCount(0);await expect(dialog).toHaveCount(0);
  const saveOrder=async(tag:string)=>{const file=path.join(root,`tests/results/reordered-${locale}-${tag}.pdf`);await fs.rm(file,{force:true});await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},file);await page.locator('.quick-actions').getByRole('button',{name:zh?'另存副本':'Save a copy',exact:true}).click();await expect.poll(async()=>!!(await fs.stat(file).catch(()=>null))).toBe(true);const data=await fs.readFile(file,'base64');return page.evaluate(async data=>{const doc=await window.studio.rpc('open',{data,name:'reordered.pdf'}),result=[];for(let i=0;i<doc.pages.length;i++){const objects=await window.studio.rpc('objects',{sid:doc.id,page:i});result.push(objects.texts.find((x:any)=>x.text.startsWith('PAGE ')).text)}await window.studio.rpc('close',{sid:doc.id});return result},data)};
  expect(await saveOrder('applied')).toEqual([2,4,6,1,3,5].map(n=>'PAGE '+n));
  await page.getByRole('button',{name:zh?'撤销':'Undo',exact:true}).click();expect(await saveOrder('undo')).toEqual([1,2,3,4,5,6].map(n=>'PAGE '+n));
  await page.getByRole('button',{name:zh?'重做':'Redo',exact:true}).click();expect(await saveOrder('redo')).toEqual([2,4,6,1,3,5].map(n=>'PAGE '+n));
  await open();await range.fill('1-6');await drag(1,6);await expect(dialog.getByRole('button',{name:zh?'应用新页序':'Apply new order',exact:true})).toHaveCount(0);
  await range.fill('4');await drag(4,1,false);await expect.poll(sequence).toEqual([4,1,2,3,5,6]);
  await dialog.getByRole('button',{name:zh?'关闭':'Close',exact:true}).click();await open();await expect.poll(sequence).toEqual([1,2,3,4,5,6]);
  expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close()}
});
