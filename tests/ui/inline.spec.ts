import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';import fs from 'node:fs/promises';

test('Chinese inline input: automatic navigation/save, IME, retarget, overflow, properties and undo',async()=>{
 const root=path.resolve('.');const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-inline-'+Date.now())]});
 const errors:string[]=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.waitForSelector('.empty');await page.evaluate(()=>localStorage.setItem('language','zh-CN'));await page.reload();
  await expect(page).toHaveTitle('OpenPDF Studio');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
  await page.locator('.empty').getByRole('button',{name:'打开 PDF',exact:true}).click();
  await page.locator('.ribbon-tabs').getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('.text-object').nth(2).click();
  const input=page.getByRole('textbox',{name:'在页面中编辑文字',exact:true});
  await expect(input).toBeFocused();await expect(page.locator('.inspector textarea')).toHaveCount(0);
  await input.fill('中文编辑测试');
  await input.dispatchEvent('compositionstart',{data:'测'});
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});
  await expect(page.locator('dialog')).toHaveCount(0);
  await input.dispatchEvent('compositionend',{data:'测试'});
  await expect(page.locator('.inline-actions')).toHaveCount(0);
  await expect(page.locator('.inspector').getByRole('button',{name:'预览修改',exact:true})).toHaveCount(0);
  // Language settings preserve the on-page draft.
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByLabel('界面语言',{exact:true}).selectOption('en-US');
  await page.locator('dialog footer').getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByTestId('text-content')).toHaveValue('中文编辑测试');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Interface language',{exact:true}).selectOption('zh-CN');
  await page.locator('dialog footer').getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'页面',exact:true})).toHaveValue('2');
  await expect(page.locator('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'上一页',exact:true}).click();
  await expect(page.getByRole('button',{name:'编辑文字: 中文编辑测试',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await page.locator('.text-object').nth(1).click();await expect(input).toBeFocused();
  const original=await input.inputValue();
  await input.press('End');await input.pressSequentially('X');
  await app.evaluate(({Menu})=>{Menu.getApplicationMenu().items.find(i=>i.label==='编辑').submenu.items.find(i=>i.label==='撤销').click()});
  await expect(input).toHaveValue(original);
  await input.fill('x'.repeat(500));await page.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('页面边界');await expect(input).toHaveValue('x'.repeat(500));
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.getByRole('spinbutton',{name:'页面',exact:true})).toHaveValue('1');
  await page.getByRole('alert').getByRole('button',{name:'关闭',exact:true}).click();
  await input.fill('Page 1: We must preserve the original layout.');
  await page.getByLabel('文字颜色',{exact:true}).fill('#ff0000');
  await expect(input).toHaveCSS('color','rgb(255, 0, 0)');
  await page.locator('.canvas-scroll').evaluate(e=>{e.scrollTop=0});
  await page.screenshot({path:'tests/results/inline-edit-zh-CN.png'});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'tests/results/inline-edit-narrow.png'});
  await input.focus();await input.press('Escape');await expect(input).toHaveCount(0);
  await expect(page.getByRole('button',{name:'编辑文字: '+original,exact:true})).toBeVisible();
  // Clicking a different object commits first and resolves that object in the new revision.
  await page.locator('.text-object').nth(1).click();await input.fill('Page 1: We must preserve the original layout.');
  const nextLabel=await page.locator('.text-object').nth(2).getAttribute('title');
  await page.locator('.text-object').nth(2).click();await expect(input).toHaveValue(nextLabel!);
  await input.fill('自动保存测试');
  const out=path.join(root,'tests/results/inline-autosave.pdf');await fs.rm(out,{force:true});
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},out);
  // Command-S while the textarea owns focus must flush before exporting.
  await input.press('Meta+s');
  await expect.poll(async()=>!!(await fs.stat(out).catch(()=>null))).toBe(true);
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  const savedBytes=await fs.readFile(out,'base64');
  const content=await page.evaluate(async data=>{const d=await window.studio.rpc('open',{data,name:'saved.pdf'});const o=await window.studio.rpc('objects',{sid:d.id,page:0});return o.texts.map(x=>x.text).join(' ');},savedBytes);
  expect(content).toContain('自动保存测试');expect(content).toContain('We must');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByRole('button',{name:'编辑文字: '+nextLabel,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'编辑文字: Page 1: We must preserve the original layout.',exact:true})).toBeVisible();
  // Blank page click applies without any confirmation dialog.
  await page.locator('.text-object').nth(2).click();await input.fill('自动应用测试');
  await page.locator('.paper').click({position:{x:20,y:20}});
  await expect(input).toHaveCount(0);await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'编辑文字: 自动应用测试',exact:true})).toBeVisible();
  await page.screenshot({path:'tests/results/automatic-edit-zh-CN.png'});
  await page.getByRole('button',{name:'编辑文字: 自动应用测试',exact:true}).click();
  await page.locator('.inspector').getByRole('button',{name:'删除文字',exact:true}).click();
  await expect(input).toHaveCount(0);await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'编辑文字: 自动应用测试',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByRole('button',{name:'编辑文字: 自动应用测试',exact:true})).toBeVisible();
  expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close()}
});
