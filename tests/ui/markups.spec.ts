import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';
for(const locale of ['zh-CN','en-US'])test(`${locale}: keyword markups preview, history, removal and persistence`,async()=>{
 const root=path.resolve('.'),t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-markups-'+locale+'-'+Date.now())]});
 try{
  const page=await app.firstWindow(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.waitForSelector('.empty');expect(await page.title()).toBe('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,850));
  const open=async(file:string)=>{await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);await page.locator('.quick-actions').getByRole('button',{name:t.open,exact:true}).click();await page.locator('.paper>img').waitFor()};
  await open(path.join(root,'test-fixtures/markups.pdf'));
  await page.locator('.ribbon-tabs').getByRole('button',{name:t.annotate,exact:true}).click();
  const button=(key:string)=>page.getByRole('button',{name:t[key],exact:true});
  const cancel=async()=>{await page.locator('dialog footer').getByRole('button',{name:t.cancel,exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0)};
  const launch=async(style='highlight')=>{await button('markup.'+style).click();await page.getByLabel(t.markupKeyword,{exact:true}).fill('合同');await page.getByLabel(t.pageRange,{exact:true}).fill('1,3');await expect(page.locator('[data-markup-page]')).toHaveCount(2)};
  await launch();await page.getByLabel(t.pageRange,{exact:true}).fill('99');await expect(button('optionalPreview')).toBeDisabled();await expect(page.locator('dialog [role=alert]')).toBeVisible();
  await page.getByLabel(t.pageRange,{exact:true}).fill('1,3');await page.getByLabel(t.markupKeyword,{exact:true}).fill('no-such-keyword');await expect(page.getByText(t.markupNoMatches,{exact:true})).toBeVisible();await expect(button('optionalPreview')).toBeDisabled();
  await page.getByLabel(t.markupKeyword,{exact:true}).fill('合同');await expect(button('optionalPreview')).toBeEnabled();await expect(page.locator('[data-markup-page]')).toHaveCount(2);
  await page.screenshot({path:`tests/results/keyword-markup-plan-${locale}.png`});await button('optionalPreview').click();await expect(page.getByText(t.markupUnchanged,{exact:true})).toBeVisible();await cancel();await expect(button('undo')).toBeDisabled();
  for(const style of ['highlight','underline','strikeout']){
   await launch(style);await button('apply').click();await expect(page.locator('dialog')).toHaveCount(0);await expect(page.locator('.comparison')).toHaveCount(0);
  }
  await launch();await expect(page.getByText(t.markupAllMarked,{exact:true})).toBeVisible();await expect(button('optionalPreview')).toBeDisabled();await cancel();
  const manage=async(count:number)=>{await button('manageMarkups').click();await expect(page.locator('[data-markup-id]')).toHaveCount(count)};
  await manage(12);await expect(page.getByText('Existing reviewer note',{exact:true})).toHaveCount(0);
  await page.locator('[data-markup-id] input').first().check();await cancel();await manage(12);
  await button('selectAll').click();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));
  await expect(button('markupRemove')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`tests/results/keyword-markup-narrow-${locale}.png`});
  await button('markupRemove').click();await expect(page.locator('.comparison')).toHaveCount(0);await expect(page.locator('dialog')).toHaveCount(0);await manage(0);await expect(page.getByText(t.markupEmpty,{exact:true})).toBeVisible();await cancel();
  await button('undo').click();await manage(12);await cancel();await button('redo').click();await manage(0);await cancel();await button('undo').click();
  const output=path.join(root,`tests/results/keyword-markup-ui-${locale}.pdf`);await fs.rm(output,{force:true});
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},output);await button('save').click();await expect(page.locator('.statusbar')).toContainText(t.saved);
  await open(output);await page.locator('.ribbon-tabs').getByRole('button',{name:t.annotate,exact:true}).click();await manage(12);await cancel();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,850));await page.locator('.paper>img').waitFor();await page.screenshot({path:`tests/results/keyword-markup-applied-${locale}.png`});
  expect(await page.locator('vite-error-overlay').count()).toBe(0);expect(errors).toEqual([]);
 }finally{await app.close()}
});
