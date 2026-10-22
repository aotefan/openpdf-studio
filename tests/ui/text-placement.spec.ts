import {test,expect,_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';

for(const locale of ['zh-CN','en-US'])test(`${locale}: place new text by mouse, grow, auto-save, cancel and undo`,async()=>{
 const root=path.resolve('.'),dir=path.join(root,'tests/results/placement-'+locale);await fs.mkdir(dir,{recursive:true});
 const file=path.join(dir,'blank.pdf');execFileSync(path.join(root,'.venv/bin/python'),['-c','import pymupdf as f,sys;d=f.open();d.new_page(width=600,height=800);d.new_page(width=600,height=800);d.save(sys.argv[1])',file]);
 const t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(dir,'profile-'+Date.now())]});
 try{
  const page=await app.firstWindow(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.waitForSelector('.empty');await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();await expect(page).toHaveTitle('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);await page.locator('.empty button.primary').click();await expect(page.locator('.paper>img')).toBeVisible();
  const button=(k:string)=>page.getByRole('button',{name:t[k],exact:true});const tab=(k:string)=>page.locator('.ribbon-tabs').getByRole('button',{name:t[k],exact:true});
  const mode=()=>page.getByTestId('text-placement'),input=()=>page.getByTestId('new-text-input');
  await tab('edit').click();await button('addText').click();await expect(page.locator('dialog')).toHaveCount(0);
  await mode().hover({position:{x:60,y:90}});const first=await page.getByTestId('text-placement-ghost').boundingBox();
  await mode().hover({position:{x:130,y:180}});const second=await page.getByTestId('text-placement-ghost').boundingBox();expect(second!.x-first!.x).toBeCloseTo(70,0);expect(second!.y-first!.y).toBeCloseTo(90,0);
  await page.screenshot({path:path.join(dir,'following-mouse.png')});await page.keyboard.press('Escape');await expect(mode()).toHaveCount(0);await expect(button('undo')).toBeDisabled();
  await button('addText').click();await mode().click({position:{x:100*.78,y:160*.78}});await expect(input()).toBeFocused();
  const initial=await input().boundingBox();await input().fill('鼠标放置文字 Mouse placement grows across the page');const grown=await input().boundingBox();expect(grown!.width).toBeGreaterThan(initial!.width);
  await input().dispatchEvent('compositionstart');await input().dispatchEvent('keydown',{key:'Enter',isComposing:true});await expect(input()).toBeVisible();await input().dispatchEvent('compositionend');
  // Zoom keeps the draft and its PDF point; no automatic commit during zoom.
  await page.getByRole('slider',{name:t.zoom,exact:true}).fill('1');await expect(input()).toHaveValue('鼠标放置文字 Mouse placement grows across the page');
  await page.screenshot({path:path.join(dir,'typing.png')});
  const out=path.join(dir,'saved.pdf');await fs.rm(out,{force:true});await app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:out})},out);
  await input().press('Meta+s');await expect.poll(async()=>!!await fs.stat(out).catch(()=>null)).toBe(true);await expect(input()).toHaveCount(0);await expect(page.locator('.dirty-dot')).toHaveCount(0);
  const data=await fs.readFile(out,'base64');const readback=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'reopened.pdf'});try{return await window.studio.rpc('objects',{sid:d.id,page:0})}finally{await window.studio.rpc('close',{sid:d.id})}},data);
  const span=readback.texts.find((x:any)=>x.text.includes('Mouse placement'));expect(span).toBeTruthy();expect(span.viewRect[0]).toBeCloseTo(100,0);expect(Math.abs(span.viewRect[1]-160)).toBeLessThan(4);
  await button('undo').click();await expect(page.locator('.text-object')).toHaveCount(0);await button('redo').click();await expect(page.locator('.text-object')).not.toHaveCount(0);
  await button('addText').click();await mode().click({position:{x:50,y:300}});await input().fill('Discard this');await input().press('Escape');await expect(mode()).toHaveCount(0);
  // A failed commit keeps the text and blocks navigation; shortening can retry.
  await button('addText').click();await mode().click({position:{x:540,y:450}});await input().fill('long '.repeat(1000));await button('next').click();await expect(page.getByRole('alert')).toBeVisible();await expect(input()).toHaveValue('long '.repeat(1000));await expect(page.locator('.statusbar input[type=number]')).toHaveValue('1');
  await input().fill('Retry');await button('next').click();await expect(mode()).toHaveCount(0);await expect(page.locator('.statusbar input[type=number]')).toHaveValue('2');
  await button('addText').click();await mode().click({position:{x:80,y:100}});await input().fill('Second page');await mode().click({position:{x:350,y:300}});await expect(mode()).toHaveCount(0);await expect(page.locator('.text-object')).toHaveCount(1);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));await button('addText').click();await mode().hover({position:{x:100,y:150}});await page.screenshot({path:path.join(dir,'small-window.png')});await page.keyboard.press('Escape');
  expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close()}
});
