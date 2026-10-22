import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';
for(const locale of ['zh-CN','en-US'])test(`${locale}: text frame expands and saves beyond original bounds`,async()=>{
 const root=path.resolve('.');const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-text-growth-'+locale+'-'+Date.now())]});const zh=locale==='zh-CN';const errors:string[]=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('.empty');await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();await page.waitForSelector('.empty');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/cjk-form.pdf'));
  await page.locator('.empty').getByRole('button',{name:zh?'打开 PDF':'Open PDF',exact:true}).click();
  await page.locator('.ribbon-tabs').getByRole('button',{name:zh?'编辑':'Edit',exact:true}).click();await page.locator('.text-object').first().click();
  const input=page.getByTestId('text-content');await expect(input).toBeFocused();const initial=(await input.boundingBox())!;
  const content='姓名：测试输入越来越长，文字区域应该自动向右扩展，完整保留内容。';
  await input.fill(content);await expect.poll(async()=>(await input.boundingBox())!.width).toBeGreaterThan(initial.width*1.8);
  await expect.poll(()=>input.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await expect(page.locator('[role=alert]')).toHaveCount(0);
  await page.screenshot({path:`tests/results/text-growth-${locale}.png`});
  const out=path.join(root,`tests/results/text-growth-${locale}.pdf`);await fs.rm(out,{force:true});await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},out);
  await input.press('Meta+s');await expect.poll(async()=>!!(await fs.stat(out).catch(()=>null))).toBe(true);await expect(input).toHaveCount(0);
  const saved=await fs.readFile(out,'base64');const objects=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'reopened.pdf'});return window.studio.rpc('objects',{sid:d.id,page:0})},saved);
  const text=objects.texts.find(x=>x.text===content);expect(text).toBeTruthy();expect(text.rect[2]-text.rect[0]).toBeGreaterThan(300);
  expect(objects.texts.some(x=>x.text==='Unchanged text')).toBe(true);
  await page.getByRole('button',{name:zh?'撤销':'Undo',exact:true}).click();await expect.poll(()=>page.locator('.text-object').first().getAttribute('title')).toContain('__________');
  await page.getByRole('button',{name:zh?'重做':'Redo',exact:true}).click();await expect(page.getByRole('button',{name:(zh?'编辑文字: ':'Edit text: ')+content,exact:true})).toHaveCount(1);
  expect(errors).toEqual([]);
 }finally{await app.close()}
});
