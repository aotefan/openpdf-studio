import {test,expect,_electron as electron} from '@playwright/test';
import path from 'node:path';

test('trackpad pinch zooms the PDF around the pointer and preserves a single-frame editor',async()=>{
 const root=path.resolve('.');const app=await electron.launch({args:[root,'--user-data-dir='+path.join(root,'tests/results/profile-gestures-'+Date.now())]});
 const errors:string[]=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
  await page.waitForSelector('.empty');await page.evaluate(()=>localStorage.setItem('language','zh-CN'));await page.reload();await page.waitForSelector('.empty');
  await expect(page).toHaveTitle('OpenPDF Studio');expect(page.url()).toContain('/dist/index.html');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'test-fixtures/research.pdf'));
  await page.locator('.empty').getByRole('button',{name:'打开 PDF',exact:true}).click();
  await page.locator('.ribbon-tabs').getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('.text-object').nth(2).click();const input=page.getByTestId('text-content');await expect(input).toBeFocused();await input.fill('中文编辑测试');
  await input.evaluate((e:HTMLTextAreaElement)=>e.setSelectionRange(2,4));
  const toolbar=await page.locator('.ribbon').boundingBox();const before=await page.locator('.paper').boundingBox();const viewport=await page.locator('.canvas-scroll').boundingBox();
  const point={x:viewport!.x+viewport!.width/2,y:viewport!.y+viewport!.height/2};
  const session=await page.context().newCDPSession(page);
  // Chromium's mouse-source pinch produces trusted trackpad-style wheel events.
  await session.send('Input.synthesizePinchGesture',{...point,scaleFactor:1.5,relativeSpeed:600,gestureSourceType:'mouse'});
  await expect.poll(async()=>(await page.locator('.paper').boundingBox())!.width).toBeGreaterThan(before!.width*1.3);
  const enlarged=await page.locator('.paper').boundingBox();
  await expect(input).toHaveValue('中文编辑测试');await expect(input).toBeFocused();
  expect(await input.evaluate((e:HTMLTextAreaElement)=>[e.selectionStart,e.selectionEnd])).toEqual([2,4]);
  expect((await page.locator('.ribbon').boundingBox())!.height).toBe(toolbar!.height);
  expect(await page.evaluate(()=>window.visualViewport!.scale)).toBe(1);
  expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getZoomFactor())).toBe(1);
  const beforeAnchor=(point.y-before!.y)/before!.height;const afterAnchor=(point.y-enlarged!.y)/enlarged!.height;expect(Math.abs(beforeAnchor-afterAnchor)).toBeLessThan(.005);
  await session.send('Input.synthesizePinchGesture',{...point,scaleFactor:.75,relativeSpeed:600,gestureSourceType:'mouse'});
  await expect.poll(async()=>(await page.locator('.paper').boundingBox())!.width).toBeLessThan(enlarged!.width*.9);
  // Ordinary two-finger scrolling must stay scrolling, not change PDF scale.
  const zoom=await page.locator('.zoom-controls input').inputValue();await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,100);
  await expect.poll(()=>page.locator('.canvas-scroll').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);expect(await page.locator('.zoom-controls input').inputValue()).toBe(zoom);
  await expect(input).toHaveCSS('outline-width','1px');await expect(input).toHaveCSS('box-shadow','none');
  await expect(page.locator('.object.editing-text')).toHaveCSS('border-top-color','rgba(0, 0, 0, 0)');
  await input.hover();await expect(page.locator('.object.editing-text')).toHaveCSS('outline-style','none');
  await page.locator('.canvas-scroll').evaluate(e=>{e.scrollTop=0});
  await page.screenshot({path:'tests/results/pinch-editor-zh-CN.png'});
  // Synthetic extreme deltas exercise explicit limits; these are not hardware gestures.
  await input.dispatchEvent('wheel',{ctrlKey:true,deltaY:-10000,clientX:point.x,clientY:point.y,bubbles:true,cancelable:true});
  await expect.poll(()=>page.locator('.zoom-controls input').inputValue()).toBe('4');
  await input.dispatchEvent('wheel',{ctrlKey:true,deltaY:10000,clientX:point.x,clientY:point.y,bubbles:true,cancelable:true});
  await expect.poll(()=>page.locator('.zoom-controls input').inputValue()).toBe('0.25');
  await input.press('Escape');await page.getByRole('button',{name:'适合页面',exact:true}).click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(980,640));
  await page.locator('.text-object').nth(2).click();await expect(input).toBeFocused();
  await page.screenshot({path:'tests/results/pinch-editor-narrow.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);expect(errors).toEqual([]);
 }finally{await app.close()}
});
