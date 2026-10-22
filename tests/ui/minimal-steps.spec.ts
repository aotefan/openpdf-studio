import {test,expect,_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';
for(const locale of ['zh-CN','en-US'])test(`${locale}: direct operations and single-apply settings keep real undoable results`,async()=>{
 const root=path.resolve('.'),t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-minimal-'+locale+'-'+Date.now())]});
 try{
  const page=await app.firstWindow(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.waitForSelector('.empty');await expect(page).toHaveTitle('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();
  const button=(key:string)=>page.getByRole('button',{name:t[key],exact:true});
  const choose=async(file:string)=>app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures',file));
  const open=async(file:string)=>{await choose(file);await page.locator('.quick-actions').getByRole('button',{name:t.open,exact:true}).click();await expect(page.locator('.paper>img')).toBeVisible()};
  const tab=async(key:string)=>page.locator('.ribbon-tabs').getByRole('button',{name:t[key],exact:true}).click();
  const undo=async()=>{await button('undo').click();await expect(page.locator('.busy-mask')).toHaveCount(0)};
  const snapshot=async(tag:string)=>{
   const output=path.join(root,`tests/results/minimal-${locale}-${tag}.pdf`);await fs.rm(output,{force:true});await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},output);
   await page.locator('.quick-actions').getByRole('button',{name:t.save,exact:true}).click();await expect.poll(async()=>!!await fs.stat(output).catch(()=>null)).toBe(true);
   return page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'readback.pdf'});try{const objects=await window.studio.rpc('objects',{sid:d.id,page:0});return {pages:d.pages,objects}}finally{await window.studio.rpc('close',{sid:d.id})}},await fs.readFile(output,'base64'));
  };
  await open('research.pdf');await tab('page');
  await page.evaluate(()=>{(window as any).__extraPreview=false;new MutationObserver(()=>{if(document.querySelector('.comparison'))(window as any).__extraPreview=true}).observe(document.body,{childList:true,subtree:true})});
  await button('rotate').click();expect((await snapshot('rotate')).pages[0].rotation).toBe(90);await expect(page.locator('dialog')).toHaveCount(0);await undo();
  await button('addPage').click();await expect(page.locator('.thumb')).toHaveCount(4);await expect(page.locator('dialog')).toHaveCount(0);await undo();await expect(page.locator('.thumb')).toHaveCount(3);
  await button('moveRight').click();expect((await snapshot('reorder')).objects.texts.some((x:any)=>x.text.includes('Page 2:'))).toBe(true);await expect(page.locator('.statusbar input[type=number]')).toHaveValue('2');await undo();
  await button('deletePage').click();await expect(page.locator('.thumb')).toHaveCount(2);await undo();await expect(page.locator('.thumb')).toHaveCount(3);
  await choose('research.pdf');await button('merge').click();await expect(page.locator('.thumb')).toHaveCount(6);await expect(page.locator('dialog')).toHaveCount(0);await undo();
  await open('images.pdf');await tab('edit');await page.locator('.image-object').click({position:{x:15,y:15}});
  await expect(page.getByTestId('image-selection')).toBeVisible();await page.getByLabel(t.imageRotation,{exact:true}).selectOption('90');await button('imageTransform').click();await expect(page.locator('.busy-mask')).toHaveCount(0);await expect(page.locator('dialog')).toHaveCount(0);
  await page.locator('.image-object').click({position:{x:15,y:15}});await choose('replacement.png');await button('replaceImage').click();expect((await snapshot('image-replaced')).objects.images).toHaveLength(1);await undo();
  await page.locator('.image-object').click({position:{x:15,y:15}});await button('deleteImage').click();await expect(page.locator('.image-object')).toHaveCount(0);await undo();await expect(page.locator('.image-object')).toHaveCount(1);
  await choose('replacement.png');await button('insertImage').click();await expect(page.locator('.image-object')).toHaveCount(2);await expect(page.locator('dialog')).toHaveCount(0);await undo();
  await open('research.pdf');await tab('edit');await button('addText').click();await expect(page.locator('dialog')).toHaveCount(0);
  await page.getByTestId('text-placement').click({position:{x:60*.78,y:420*.78}});await page.getByTestId('new-text-input').fill('Single apply text');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));
  await page.screenshot({path:`tests/results/minimal-settings-${locale}.png`});await page.getByTestId('new-text-input').press('Enter');await expect(page.getByTestId('new-text-input')).toHaveCount(0);
  expect((await snapshot('text-added')).objects.texts.some((x:any)=>x.text==='Single apply text')).toBe(true);await undo();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,850));await tab('page');await button('rotate').click();await expect(page.locator('.busy-mask')).toHaveCount(0);await expect(page.locator('.paper>img')).toBeVisible();await page.screenshot({path:`tests/results/minimal-rotation-${locale}.png`});
  expect(await page.evaluate(()=>(window as any).__extraPreview)).toBe(false);expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close()}
});
