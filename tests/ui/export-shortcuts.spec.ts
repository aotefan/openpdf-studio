import {test,expect,_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';

for(const locale of ['zh-CN','en-US'])test(`${locale}: format shortcuts save once, cancel, recover and preserve edits`,async()=>{
 const root=path.resolve('.'),t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const output=path.join(root,'tests/results/export-shortcuts-'+locale);await fs.mkdir(output,{recursive:true});
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(output,'profile-'+Date.now())]});
 try{
  const page=await app.firstWindow(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.waitForSelector('.empty');await expect(page).toHaveTitle('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();
  const button=(k:string)=>page.getByRole('button',{name:t[k],exact:true});
  const tab=(k:string)=>page.locator('.ribbon-tabs').getByRole('button',{name:t[k],exact:true});
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
  await page.locator('.empty').getByRole('button',{name:t.open,exact:true}).click();await expect(page.locator('.paper>img')).toBeVisible();
  await tab('page').click();await button('rotate').click();await expect(button('undo')).toBeEnabled();await tab('convert').click();
  await page.evaluate(()=>{(window as any).__dialogSeen=false;new MutationObserver(()=>{if(document.querySelector('dialog'))(window as any).__dialogSeen=true}).observe(document.body,{subtree:true,childList:true})});
  const saveTo=async(file:string,cancel=false)=>app.evaluate(({dialog},{file,cancel})=>{
   (globalThis as any).__saveCalls=[];
   dialog.showSaveDialog=async(_win,options)=>{(globalThis as any).__saveCalls.push(options);return {canceled:cancel,filePath:file}};
  },{file,cancel});
  const calls=()=>app.evaluate(()=>(globalThis as any).__saveCalls);
  for(const format of ['docx','xlsx','pptx']){
   const file=path.join(output,'export.'+format);await fs.rm(file,{force:true});await saveTo(file);
   await button(format).click();await expect.poll(async()=>(await calls()).length).toBe(1);await expect(page.locator('.busy-mask')).toHaveCount(0);
   expect((await fs.stat(file)).size).toBeGreaterThan(100);
   const options=(await calls())[0];expect(options.defaultPath).toBe('research-edited.'+format);expect(options.filters[0].extensions).toEqual([format]);
   await expect(page.locator('dialog')).toHaveCount(0);await expect(page.locator('.dirty-dot')).toHaveCount(1);await expect(button('undo')).toBeEnabled();
  }
  const cancelled=path.join(output,'cancelled.docx');await fs.rm(cancelled,{force:true});await saveTo(cancelled,true);await button('docx').click();
  await expect.poll(async()=>(await calls()).length).toBe(1);await expect(page.locator('.busy-mask')).toHaveCount(0);expect(await fs.stat(cancelled).catch(()=>null)).toBeNull();await expect(page.getByRole('alert')).toHaveCount(0);
  await saveTo(path.join(output,'missing-'+Date.now(),'failed.docx'));await button('docx').click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.busy-mask')).toHaveCount(0);await expect(button('undo')).toBeEnabled();
  await saveTo(path.join(output,'retry.docx'));await button('docx').click();await expect.poll(async()=>(await calls()).length).toBe(1);await expect(page.locator('.busy-mask')).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await fs.stat(path.join(output,'retry.docx'))).size).toBeGreaterThan(100);
  expect(await page.evaluate(()=>(window as any).__dialogSeen)).toBe(false);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));await expect(button('docx')).toBeInViewport();await expect(button('xlsx')).toBeInViewport();await expect(button('pptx')).toBeInViewport();
  await page.screenshot({path:path.join(output,'shortcuts.png')});
  // The generic command still asks for a format, because none was selected yet.
  await tab('home').click();await page.locator('.ribbon').getByRole('button',{name:t.convert,exact:true}).click();
  await page.locator('dialog select').selectOption('txt');await saveTo(path.join(output,'generic.txt'));
  await page.locator('dialog footer').getByRole('button',{name:t.convert,exact:true}).click();await expect.poll(async()=>(await calls()).length).toBe(1);await expect(page.locator('.busy-mask')).toHaveCount(0);
  expect(await fs.readFile(path.join(output,'generic.txt'),'utf8')).toContain('OpenPDF Studio');
  await expect(page.locator('.dirty-dot')).toHaveCount(1);await button('undo').click();await expect(page.locator('.busy-mask')).toHaveCount(0);await expect(button('redo')).toBeEnabled();
  const readback=JSON.parse(execFileSync(path.join(root,'.venv/bin/python'),['-c',
   'import sys,json;from pathlib import Path;from docx import Document;from openpyxl import load_workbook;from pptx import Presentation;p=Path(sys.argv[1]);print(json.dumps({"word":any("OpenPDF Studio" in x.text for x in Document(p/"export.docx").paragraphs),"excel":len(load_workbook(p/"export.xlsx").worksheets),"ppt":len(Presentation(p/"export.pptx").slides)}))',output],{encoding:'utf8'}));
  expect(readback).toEqual({word:true,excel:3,ppt:3});await fs.writeFile(path.join(output,'readback.json'),JSON.stringify(readback,null,2));
  expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close()}
});
