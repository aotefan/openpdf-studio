import {test,expect,_electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

for(const locale of ['zh-CN','en-US'])test(`${locale}: high-resolution PNG, page ranges, retry and batch quality`,async()=>{
 const root=process.cwd(),dir=await fs.mkdtemp(path.join(os.tmpdir(),'openpdf-hd-'));
 const t=JSON.parse(await fs.readFile(`src/i18n/${locale}.json`,'utf8'));
 const evidence=process.env.OPENPDF_EVIDENCE||path.join(os.tmpdir(),'openpdf-hd-export');
 await fs.mkdir(evidence,{recursive:true});
 const app=await electron.launch({args:[root,'--user-data-dir='+path.join(dir,'profile')]});
 const inspect=(file:string)=>JSON.parse(execFileSync(path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python'),['-X','utf8','-c',
  'import sys,json,io,zipfile;from PIL import Image;z=zipfile.ZipFile(sys.argv[1]);rows=[]\nfor n in z.namelist():\n im=Image.open(io.BytesIO(z.read(n)));rows.append({"name":n,"size":list(im.size),"dpi":[round(v) for v in im.info["dpi"]]})\nprint(json.dumps(rows))',file],{encoding:'utf8'}));
 try{
  const page=await app.firstWindow(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.locator('.empty').waitFor();await page.evaluate(l=>localStorage.setItem('language',l),locale);await page.reload();
  await expect(page).toHaveTitle('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
  await page.locator('.empty').getByRole('button',{name:t.open,exact:true}).click();await page.locator('.paper>img').waitFor();
  const tab=(key:string)=>page.locator('.ribbon-tabs').getByRole('button',{name:t[key],exact:true});
  const tool=(key:string)=>page.locator('.ribbon').getByRole('button',{name:t[key],exact:true});
  const dialog=page.locator('dialog');
  const saveTo=async(file:string,canceled=false)=>app.evaluate(({dialog},{file,canceled})=>{
   (globalThis as any).__hdSaveCalls=0;
   dialog.showSaveDialog=async()=>{(globalThis as any).__hdSaveCalls++;return {canceled,filePath:file}};
  },{file,canceled});
  await tab('page').click();await tool('rotate').click();await expect(page.locator('.dirty-dot')).toHaveCount(1);
  await tab('convert').click();await tool('png').click();
  await expect(dialog.getByLabel(t.imageResolution,{exact:true})).toHaveValue('300');
  await dialog.getByLabel(t.pageRange,{exact:true}).fill('0');
  await expect(dialog.getByRole('button',{name:t.exportImages,exact:true})).toBeDisabled();
  await dialog.getByLabel(t.pageRange,{exact:true}).fill('2');
  const cancelled=path.join(dir,'cancelled.zip');await saveTo(cancelled,true);
  await dialog.getByRole('button',{name:t.exportImages,exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>(globalThis as any).__hdSaveCalls)).toBe(1);
  await expect(dialog.getByRole('button',{name:t.exportImages,exact:true})).toBeEnabled();
  expect(await fs.stat(cancelled).catch(()=>null)).toBeNull();await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByLabel(t.imageResolution,{exact:true}).selectOption('600');
  await expect(dialog.getByRole('status')).toContainText('4959');await expect(dialog.getByRole('status')).toContainText('7017');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));
  await expect(dialog.getByRole('button',{name:t.exportImages,exact:true})).toBeInViewport();
  await page.screenshot({path:path.join(evidence,`image-export-600-${locale}.png`)});
  const ultra=path.join(dir,'高清 中文 600.zip');await saveTo(ultra);
  await dialog.getByRole('button',{name:t.exportImages,exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(inspect(ultra)).toEqual([{name:'page-2.png',size:[4959,7017],dpi:[600,600]}]);
  await expect(page.locator('.dirty-dot')).toHaveCount(1);
  await expect(page.getByRole('button',{name:t.undo,exact:true})).toBeEnabled();
  // A write failure keeps the chosen quality/range and permits retry.
  await tool('png').click();await dialog.getByLabel(t.pageRange,{exact:true}).fill('3');
  await saveTo(path.join(dir,'missing','failed.zip'));
  await dialog.getByRole('button',{name:t.exportImages,exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel(t.imageResolution,{exact:true})).toHaveValue('300');
  const retry=path.join(dir,'retry.zip');await saveTo(retry);
  await dialog.getByRole('button',{name:t.exportImages,exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(inspect(retry)).toEqual([{name:'page-3.png',size:[2480,3509],dpi:[300,300]}]);
  // The generic conversion path exposes and forwards the same DPI options.
  await tab('home').click();await tool('convert').click();await dialog.locator('select').selectOption('png');
  await expect(dialog.getByLabel(t.imageResolution,{exact:true})).toHaveValue('300');
  await dialog.getByLabel(t.imageResolution,{exact:true}).selectOption('150');
  const compact=path.join(dir,'compact.zip');await saveTo(compact);
  await dialog.locator('footer').getByRole('button',{name:t.convert,exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('.busy-mask')).toHaveCount(0);
  const compactImages=inspect(compact);expect(compactImages).toHaveLength(3);
  expect(compactImages[0]).toEqual({name:'page-1.png',size:[1755,1240],dpi:[150,150]});
  // Batch conversion exports the original source using its selected resolution.
  await tab('convert').click();await tool('batchConvert').click();
  await dialog.getByLabel(t.batchOutputFormat,{exact:true}).selectOption('png');
  await expect(dialog.getByLabel(t.imageResolution,{exact:true})).toHaveValue('300');
  await dialog.getByLabel(t.imageResolution,{exact:true}).selectOption('600');
  await app.evaluate(({dialog},{file,folder})=>{dialog.showOpenDialog=async(_w,options)=>({canceled:false,filePaths:[options.properties.includes('openDirectory')?folder:file]})},{file:path.join(root,'test-fixtures/research.pdf'),folder:dir});
  await dialog.getByRole('button',{name:t.batchChooseFiles,exact:true}).click();
  await dialog.getByRole('button',{name:t.batchChooseFolder,exact:true}).click();
  await expect(dialog.locator('[data-batch-file]')).toContainText('600dpi.zip');
  await expect(dialog.getByRole('button',{name:t.batchStart,exact:true})).toBeInViewport();
  await page.screenshot({path:path.join(evidence,`image-batch-600-${locale}.png`)});
  await dialog.getByRole('button',{name:t.batchStart,exact:true}).click();await expect(dialog.locator('.batch-success')).toBeVisible();
  const result=(await fs.readdir(dir)).find(name=>name.startsWith('OpenPDF-'))!;
  const batchImages=inspect(path.join(dir,result,'001-research-600dpi.zip'));
  expect(batchImages).toHaveLength(3);expect(batchImages[0]).toEqual({name:'page-1.png',size:[4959,7017],dpi:[600,600]});
  expect(errors).toEqual([]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:500})}
});
