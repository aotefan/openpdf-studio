import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';
for(const locale of ['zh-CN','en-US'])test(`${locale}: multi-file conversions, rollback, cancel and Finder`,async()=>{
 const root=path.resolve('.'),zh=locale==='zh-CN';const t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const output=path.join(root,'tests/results/conversion-output-'+locale+'-'+Date.now());await fs.mkdir(output,{recursive:true});
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-conversion-'+locale+'-'+Date.now())]});
 const results:Record<string,string>={};
 try{
 const page=await app.firstWindow();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForSelector('.empty');expect(await page.title()).toBe('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
 await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,850));
 const choose=async(files:string[])=>{await app.evaluate(({dialog},{files,output})=>{dialog.showOpenDialog=async(_w,options)=>({canceled:false,filePaths:options.properties.includes('openDirectory')?[output]:files})},{files:files.map(f=>path.join(root,'test-fixtures',f)),output});await page.getByRole('button',{name:t.batchChooseFiles,exact:true}).click()};
 await page.locator('.ribbon-tabs').getByRole('button',{name:t.batch,exact:true}).click();await page.getByRole('button',{name:t.batchConvert,exact:true}).click();
 await expect(page.getByRole('button',{name:t.batchStart,exact:true})).toBeDisabled();
 await choose(['research.pdf','page-order.pdf']);await page.getByRole('button',{name:t.batchChooseFolder,exact:true}).click();await expect(page.locator('[data-batch-file]')).toHaveCount(2);
 const format=page.getByLabel(t.batchOutputFormat,{exact:true});
 await page.locator('.batch-limits summary').click();await expect(page.locator('.batch-limits p')).toBeVisible();await page.locator('.batch-limits summary').click();
 await page.screenshot({path:`tests/results/batch-conversion-plan-${locale}.png`});
 // Native PNG rendering provides time to cancel while a file is in flight.
 await format.selectOption('png');await page.getByRole('button',{name:t.batchStart,exact:true}).click();await page.getByRole('button',{name:t.batchCancel,exact:true}).click();
 await expect(page.getByText(t.batchCancelled,{exact:true})).toBeVisible();expect(await fs.readdir(output)).toEqual([]);
 // The second source needs OCR; the first output must be rolled back as well.
 await choose(['research.pdf','ocr-batch.pdf']);await format.selectOption('txt');await page.getByRole('button',{name:t.batchStart,exact:true}).click();
 await expect(page.locator('dialog [role=alert]')).toContainText(t['error.batchNeedsOcr']);expect(await fs.readdir(output)).toEqual([]);
 await choose(['research.pdf','page-order.pdf']);
 for(const kind of zh?['txt','docx','xlsx','pptx','png']:['txt']){
  await format.selectOption(kind);await page.getByRole('button',{name:t.batchStart,exact:true}).click();
  await expect(page.locator('.batch-success')).toBeVisible();await expect(page.locator('[data-batch-file]').first()).toContainText(t['batchFile.saved']);
  const text=await page.locator('.batch-success').innerText();const folder=text.split('\n').slice(1).join('\n');results[kind]=folder;
  const names=await fs.readdir(folder);expect(names).toHaveLength(2);expect(names[0]).toMatch(/^001-/);expect(names[1]).toMatch(/^002-/);
 }
 await app.evaluate(({shell})=>{shell.openPath=async p=>{(globalThis as any).__revealedBatch=p;return ''}});
 await page.getByRole('button',{name:t.batchReveal,exact:true}).click();expect(await app.evaluate(()=>(globalThis as any).__revealedBatch)).toBe(Object.values(results).at(-1));
 await page.screenshot({path:`tests/results/batch-conversion-success-${locale}.png`});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));await expect(page.getByRole('button',{name:t.batchReveal,exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`tests/results/batch-conversion-narrow-${locale}.png`});
 expect(await page.locator('vite-error-overlay').count()).toBe(0);expect(errors).toEqual([]);
 await page.locator('dialog footer').getByRole('button',{name:t.close,exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);await expect(page.locator('.empty')).toBeVisible();
 }finally{await fs.writeFile(`tests/results/batch-conversion-files-${locale}.json`,JSON.stringify(results,null,2));await app.close()}
});
