import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';
const root=path.resolve('.');const fixture=path.join(root,'test-fixtures/research.pdf');
for(const locale of ['zh-CN','en-US']){
 test(`${locale}: open, edit, automatic apply, undo, save and language switch`,async()=>{
 const profile=path.join(root,'tests/results/profile-'+locale+'-'+Date.now());
 const app=await electron.launch({args:[root,'--user-data-dir='+profile],cwd:root});
 try{
 const page=await app.firstWindow();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1496,855));
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},fixture);
 await page.waitForSelector('.empty');
 await page.evaluate(lng=>{localStorage.setItem('language',lng)},locale);await page.reload();await page.waitForSelector('.empty');
 const nativeLabels=await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.map(i=>i.label));expect(nativeLabels).toContain(locale==='zh-CN'?'文件':'File');
 const zh=locale==='zh-CN';const text={open:zh?'打开 PDF':'Open PDF',edit:zh?'编辑':'Edit',save:zh?'另存副本':'Save a copy',undo:zh?'撤销':'Undo',redo:zh?'重做':'Redo',settings:zh?'设置':'Settings',language:zh?'界面语言':'Interface language',close:zh?'关闭':'Close',preview:zh?'预览修改':'Preview changes'};
 await page.locator('.empty').getByRole('button',{name:text.open,exact:true}).click();
 await expect(page.locator('.paper>img')).toBeVisible();await expect(page.locator('.thumb')).toHaveCount(3);
 await page.locator('.ribbon-tabs').getByRole('button',{name:text.edit,exact:true}).click();
 await page.locator('.text-object').filter({hasText:''}).nth(1).click();
 await expect(page.getByTestId('text-content')).toHaveValue('Page 1: We should preserve the original layout.');
 await page.screenshot({path:`tests/results/openpdf-${locale}.png`});
 await page.getByTestId('text-content').fill('Page 1: We must preserve the original layout.');
 await expect(page.locator('.paper').getByTestId('text-content')).toBeVisible();
 await page.getByTestId('text-content').press('Enter');
 await expect(page.getByTestId('text-content')).toHaveCount(0);await expect(page.locator('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:text.undo,exact:true})).toBeEnabled();
 await page.getByRole('button',{name:text.undo,exact:true}).click();await expect(page.getByRole('button',{name:text.redo,exact:true})).toBeEnabled();
 await page.getByRole('button',{name:text.redo,exact:true}).click();
 const out=path.join(root,`tests/results/roundtrip-${locale}.pdf`);await fs.rm(out,{force:true});
 await app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:out});},out);
 await page.getByRole('button',{name:text.save,exact:true}).first().click();await expect.poll(async()=>!!(await fs.stat(out).catch(()=>null))).toBeTruthy();
 const savedBytes=await fs.readFile(out,'base64');const savedText=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'roundtrip.pdf'});const o=await window.studio.rpc('objects',{sid:d.id,page:0});return o.texts.map(x=>x.text).join(' ');},savedBytes);expect(savedText).toContain('We must');
 await page.getByRole('button',{name:text.settings,exact:true}).click();await page.getByLabel(text.language,{exact:true}).selectOption(zh?'en-US':'zh-CN');
 await page.locator('dialog footer').getByRole('button',{name:zh?'Close':'关闭',exact:true}).click();
 await expect(page.locator('.file-tab')).toContainText('research.pdf');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang',zh?'en-US':'zh-CN');
 }finally{await app.close()}
 });
}
