import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';
for(const locale of ['zh-CN','en-US'])test(`${locale}: batch OCR range, cancellation, preview, search, save and history`,async()=>{
 const root=path.resolve('.'),zh=locale==='zh-CN';
 const labels=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-ocr-'+locale+'-'+Date.now())]});
 try{
 const page=await app.firstWindow();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.empty');await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,850));
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/ocr-batch.pdf'));
 await page.locator('.empty').getByRole('button',{name:labels.open,exact:true}).click();await expect(page.locator('.paper>img')).toBeVisible();
 await page.locator('.ribbon-tabs').getByRole('button',{name:labels.batch,exact:true}).click();
 await page.getByRole('button',{name:labels.batchOcr,exact:true}).click();
 const range=page.getByLabel(labels.pageRange,{exact:true}),start=page.getByRole('button',{name:labels.ocrStart,exact:true});
 await expect(page.locator('[data-ocr-page]')).toHaveCount(6);await expect(page.locator('[data-ocr-page="3"]')).toContainText(labels['ocr.status.skipText']);
 await range.fill('7');await expect(start).toBeDisabled();await expect(range).toHaveAttribute('aria-invalid','true');
 await range.fill('3-6');await expect(page.locator('[data-ocr-page]')).toHaveCount(4);await expect(start).toBeDisabled();
 await page.getByRole('button',{name:labels.ocrCurrentPage,exact:true}).click();await expect(range).toHaveValue('1');await expect(start).toBeEnabled();
 await page.getByRole('button',{name:labels.ocrAllPages,exact:true}).click();await expect(start).toBeEnabled();
 await page.screenshot({path:`tests/results/ocr-plan-${locale}.png`});
 // Real Vision work; cancellation is requested while the first native page is running.
 await start.click();await page.getByRole('button',{name:labels.ocrCancel,exact:true}).click();
 await expect(page.getByText(labels.ocrCancelled,{exact:true})).toBeVisible();await expect(start).toBeEnabled();
 await expect(page.getByRole('button',{name:labels.undo,exact:true})).toBeDisabled();
 await start.click();await expect(page.getByTestId('apply-preview')).toBeVisible();
 await expect(page.locator('[data-ocr-page="1"]')).toContainText('中文文字识别测试');
 await expect(page.locator('[data-ocr-page="2"]')).toContainText('本地处理保护文档');
 await expect(page.locator('.comparison img')).toHaveCount(2);
 await page.screenshot({path:`tests/results/ocr-preview-${locale}.png`});
 if(!zh){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));await expect(page.getByTestId('apply-preview')).toBeInViewport();await page.screenshot({path:'tests/results/ocr-narrow-en-US.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.getByTestId('apply-preview').click();await expect(page.locator('dialog')).toHaveCount(0);
 const search=page.getByRole('textbox',{name:labels.search,exact:true});await search.fill('中文文字识别测试');await expect(search).toBeEnabled();await search.press('Enter');await expect(page.locator('.search-list h4')).toContainText('1');
 await page.getByRole('button',{name:labels.undo,exact:true}).click();await expect(page.getByRole('button',{name:labels.redo,exact:true})).toBeEnabled();
 await expect(search).toBeEnabled();await search.press('Enter');await expect(page.locator('.search-list h4')).toContainText('0');
 await page.getByRole('button',{name:labels.redo,exact:true}).click();await expect(search).toBeEnabled();await search.press('Enter');await expect(page.locator('.search-list h4')).toContainText('1');
 const file=path.join(root,`tests/results/ocr-ui-${locale}.pdf`);await fs.rm(file,{force:true});
 await app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:out})},file);
 await page.locator('.quick-actions').getByRole('button',{name:labels.save,exact:true}).click();await expect.poll(async()=>!!(await fs.stat(file).catch(()=>null))).toBe(true);
 const saved=await fs.readFile(file,'base64');const readback=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'saved.pdf'});const o=await window.studio.rpc('objects',{sid:d.id,page:0});await window.studio.rpc('close',{sid:d.id});return o.texts.map(x=>x.text).join('\n')},saved);expect(readback).toContain('中文文字识别测试');expect(errors).toEqual([]);
 }finally{await app.close()}
});
