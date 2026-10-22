import {test,expect,_electron as electron} from '@playwright/test';import path from 'node:path';import fs from 'node:fs/promises';
test('Chinese: search, page tools, batch replacement and selected conversion',async()=>{
 const root=path.resolve('.');const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-tools-'+Date.now())]});
 try{
 const page=await app.firstWindow();await page.waitForSelector('.empty');await page.evaluate(()=>localStorage.setItem('language','zh-CN'));await page.reload();
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
 await page.locator('.empty').getByRole('button',{name:'打开 PDF',exact:true}).click();await expect(page.locator('.paper>img')).toBeVisible();
 await page.getByRole('textbox',{name:'搜索文档'}).fill('should');await page.getByRole('textbox',{name:'搜索文档'}).press('Enter');await expect(page.locator('.search-list h4')).toHaveText('6 处匹配');
 await page.locator('.ribbon-tabs').getByRole('button',{name:'页面',exact:true}).click();await page.getByRole('button',{name:'旋转页面',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeEnabled();await page.getByRole('button',{name:'撤销',exact:true}).click();
 await page.getByRole('button',{name:'添加页面',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);await page.getByRole('button',{name:'缩略图',exact:true}).click();await expect(page.locator('.thumb')).toHaveCount(4);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.locator('.thumb')).toHaveCount(3);
 await page.locator('.ribbon-tabs').getByRole('button',{name:'批量处理',exact:true}).click();await page.getByRole('button',{name:'全文替换',exact:true}).click();await page.getByLabel('查找文字',{exact:true}).fill('should');await page.getByLabel('替换为',{exact:true}).fill('must');await page.locator('dialog').getByRole('button',{name:'预览修改',exact:true}).click();await expect(page.locator('.preview-summary')).toContainText('计划修改 6 处');await page.getByTestId('apply-preview').click();
 await page.locator('.ribbon-tabs').getByRole('button',{name:'转换',exact:true}).click();
 const out=path.join(root,'tests/results/ui-export.xlsx');await fs.rm(out,{force:true});await app.evaluate(({dialog},out)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:out})},out);await page.getByRole('button',{name:'Excel · 表格',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);await expect.poll(async()=>!!(await fs.stat(out).catch(()=>null))).toBeTruthy();
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.screenshot({path:'tests/results/settings-zh-CN.png'});await page.locator('dialog footer').getByRole('button',{name:'关闭',exact:true}).click();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'tests/results/narrow-zh-CN.png'});
 }finally{await app.close()}
});
