import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';

for(const locale of ['zh-CN','en-US'])test(`${locale}: drag, resize, cancel, undo, save and reopen images`,async()=>{
 const root=path.resolve('.');const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-images-'+locale+'-'+Date.now())]});
 const errors:string[]=[];const zh=locale==='zh-CN';
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await page.waitForSelector('.empty');await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();await page.waitForSelector('.empty');
  await expect(page).toHaveTitle('OpenPDF Studio');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/images.pdf'));
  await page.locator('.empty').getByRole('button',{name:zh?'打开 PDF':'Open PDF',exact:true}).click();
  await page.locator('.ribbon-tabs').getByRole('button',{name:zh?'编辑':'Edit',exact:true}).click();
  await page.locator('.image-object').click({position:{x:15,y:15}});
  const selection=page.getByTestId('image-selection');await expect(selection).toBeVisible();await expect(selection.locator('.image-handle')).toHaveCount(8);
  const original=(await selection.boundingBox())!;
  const move=async(dx:number,dy:number)=>{const b=(await selection.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:5});};
  await move(35,28);await expect(page.locator('.image-drag-sprite')).toBeVisible();await page.mouse.up();
  await expect(page.locator('.image-drag-sprite')).toHaveCount(0);await expect(selection).toBeVisible();
  await expect.poll(async()=>Math.round((await selection.boundingBox())!.x-original.x)).toBe(35);
  await expect(page.locator('dialog')).toHaveCount(0);
  const moved=(await selection.boundingBox())!;expect(moved.y-original.y).toBeCloseTo(28,0);
  // Escape restores the live drag without a PDF history entry.
  await move(45,15);await page.keyboard.press('Escape');await page.mouse.up();
  expect((await selection.boundingBox())!.x).toBeCloseTo(moved.x,0);
  await page.getByRole('button',{name:zh?'撤销':'Undo',exact:true}).click();
  await expect.poll(async()=>Math.abs(((await page.locator('.image-object').boundingBox())?.x??-999)-original.x)).toBeLessThan(.5);
  await page.getByRole('button',{name:zh?'重做':'Redo',exact:true}).click();
  await expect.poll(async()=>Math.abs(((await page.locator('.image-object').boundingBox())?.x??-999)-moved.x)).toBeLessThan(.5);
  await page.locator('.image-object').click({position:{x:15,y:15}});await expect(selection).toBeVisible();
  const handle=selection.locator('[data-handle=se]');const h=(await handle.boundingBox())!;
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+46,h.y+h.height/2+25,{steps:5});await page.mouse.up();
  await expect(page.locator('.image-drag-sprite')).toHaveCount(0);
  await expect.poll(async()=>(await selection.boundingBox())?.width||0).toBeGreaterThan(moved.width+40);
  const resized=(await selection.boundingBox())!;expect(resized.width/resized.height).toBeCloseTo(original.width/original.height,2);
  await expect(page.locator('.image-drag-sprite')).toHaveCount(0);
  await expect(page.locator('.paper>img')).toBeVisible();
  await page.screenshot({path:`tests/results/image-edit-${locale}.png`});
  const out=path.join(root,`tests/results/image-roundtrip-${locale}.pdf`);await fs.rm(out,{force:true});
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},out);
  await page.getByRole('button',{name:zh?'另存副本':'Save a copy',exact:true}).first().click();
  await expect.poll(async()=>!!(await fs.stat(out).catch(()=>null))).toBe(true);
  const saved=await fs.readFile(out,'base64');const result=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'saved.pdf'});return window.studio.rpc('objects',{sid:d.id,page:0})},saved);
  expect(result.images).toHaveLength(1);expect(result.images[0].rect[0]).toBeGreaterThan(100);expect(result.images[0].rect[2]-result.images[0].rect[0]).toBeGreaterThan(290);expect(result.texts.map(x=>x.text).join(' ')).toContain('TEXT ABOVE IMAGE');
  await page.getByRole('button',{name:zh?'撤销':'Undo',exact:true}).click();
  await expect.poll(async()=>Math.abs(((await page.locator('.image-object').boundingBox())?.width??0)-moved.width)).toBeLessThan(.5);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await app.close()}
});
