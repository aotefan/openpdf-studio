import {test,expect,_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
for(const locale of ['zh-CN','en-US'])test(`${locale}: reading caret activates editing only when text changes`,async()=>{
 const root=path.resolve('.'),dir=path.join(root,'tests/results/type-to-edit-'+locale);await fs.mkdir(dir,{recursive:true});
 const t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(dir,'profile-'+Date.now())]});
 try{
  const page=await app.firstWindow(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.waitForSelector('.empty');await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();await expect(page).toHaveTitle('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
  await page.locator('.empty button.primary').click();await expect(page.locator('.paper>img')).toBeVisible();
  const button=(k:string)=>page.getByRole('button',{name:t[k],exact:true});const tab=(k:string)=>page.locator('.ribbon-tabs').getByRole('button',{name:t[k],exact:true});
  const span=page.locator('.text-object').nth(1),input=page.getByTestId('text-content');
  await span.hover();await expect(span).toHaveCSS('cursor','text');await expect(span).toHaveCSS('border-top-color','rgba(0, 0, 0, 0)');await expect(tab('home')).toHaveClass('selected');await expect(input).toHaveCount(0);
  await span.click({position:{x:55,y:5}});await expect(input).toBeFocused();await expect(input).toHaveClass(/reading-caret/);await expect(input).toHaveCSS('outline-style','none');await expect(page.locator('.inline-backdrop')).toHaveCount(0);await expect(tab('home')).toHaveClass('selected');await expect(button('undo')).toBeDisabled();
  await expect(page.locator('.inspector .field-row')).toHaveCount(0);
  const original=await input.inputValue();const offset=await input.evaluate(e=>(e as HTMLTextAreaElement).selectionStart);
  await page.screenshot({path:path.join(dir,'reading-caret.png')});
  await input.pressSequentially('X');await expect(tab('edit')).toHaveClass('selected');await expect(input).toHaveValue(original.slice(0,offset)+'X'+original.slice(offset));await expect(input).not.toHaveClass(/reading-caret/);await expect(page.locator('.inline-backdrop')).toBeVisible();
  await input.pressSequentially('YZ');const edited=original.slice(0,offset)+'XYZ'+original.slice(offset);await expect(input).toHaveValue(edited);
  await expect(page.locator('dialog')).toHaveCount(0);await expect(button('undo')).toBeDisabled();
  await page.screenshot({path:path.join(dir,'typing-edit.png')});
  const output=path.join(dir,'saved.pdf');await fs.rm(output,{force:true});await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},output);
  await input.press('Meta+s');await expect.poll(async()=>!!await fs.stat(output).catch(()=>null)).toBe(true);await expect(input).toHaveCount(0);await expect(button('undo')).toBeEnabled();
  const readback=execFileSync(path.join(root,'.venv/bin/python'),['-c','from pypdf import PdfReader;import sys;print(PdfReader(sys.argv[1]).pages[0].extract_text())',output],{encoding:'utf8'});expect(readback).toContain(edited);
  await button('undo').click();await expect(page.getByRole('button',{name:t.editText+': '+original,exact:true})).toBeVisible();
  await tab('home').click();await span.click();await input.press('Escape');await expect(tab('home')).toHaveClass('selected');await expect(input).toHaveCount(0);
  // Typing elsewhere must not switch to the text editor or touch the document.
  await page.getByRole('textbox',{name:t.search,exact:true}).fill('search');await expect(tab('home')).toHaveClass('selected');
  await span.click();await input.press('ArrowRight');await expect(tab('home')).toHaveClass('selected');await input.press('Escape');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));await span.click();await input.dispatchEvent('compositionstart');await input.dispatchEvent('keydown',{key:'Enter',isComposing:true});await expect(tab('home')).toHaveClass('selected');
  await input.fill('中文输入测试');await input.dispatchEvent('compositionend');await expect(tab('edit')).toHaveClass('selected');await expect(input).toHaveValue('中文输入测试');await input.press('Escape');
  expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close()}
});
