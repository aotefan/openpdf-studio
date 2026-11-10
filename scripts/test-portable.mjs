import {expect, _electron as electron} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {patched} = require('./check-runtime.cjs');
const {pythonPath} = require('../desktop/platform.cjs');
const root = process.cwd();
const {version, devDependencies} = JSON.parse(await fs.readFile('package.json', 'utf8'));
const source = process.argv[2] || path.join(root, 'release/artifacts.noindex', version, `OpenPDF Studio-${process.platform}-${process.arch}`);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'openpdf-portable-'));
const copied = path.join(temp, '中文 空格', 'OpenPDF Studio');
let app;
try {
  await fs.cp(source, copied, {recursive: true, verbatimSymlinks: true});
  const executablePath = process.platform === 'win32' ? path.join(copied, 'OpenPDF Studio.exe') : path.join(copied, 'OpenPDF Studio.app/Contents/MacOS/OpenPDF Studio');
  app = await electron.launch({executablePath, cwd: temp, args: ['--user-data-dir=' + path.join(temp, 'profile')], env: {...process.env, PYTHONPATH: '', PYTHONHOME: '', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1'}});
  const runtime = await app.evaluate(({app}) => ({electron: process.versions.electron, node: process.versions.node, packaged: app.isPackaged}));
  expect(runtime.packaged).toBe(true);
  expect(runtime.electron).toBe(devDependencies.electron);
  expect(patched(runtime.node)).toBe(true);
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await expect(page).toHaveTitle('OpenPDF Studio');
  await page.locator('.empty').waitFor();
  await page.evaluate(() => localStorage.setItem('language', 'zh-CN'));
  await page.reload();
  const fixture = path.join(temp, '合同 中文.pdf');
  await fs.copyFile('test-fixtures/research.pdf', fixture);
  await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [file]}); }, fixture);
  await page.locator('.empty').getByRole('button', {name: '打开 PDF', exact: true}).click();
  await page.locator('.paper>img').waitFor();
  await expect(page.locator('.file-tab')).toContainText('合同 中文.pdf');
  const label = await page.getByRole('button', {name: '另存副本', exact: true}).first().getAttribute('title');
  expect(label).toContain(process.platform === 'darwin' ? '⌘S' : 'Ctrl+S');
  await page.locator('.ribbon-tabs').getByRole('button', {name: '页面', exact: true}).click();
  await page.locator('.ribbon').getByRole('button', {name: '旋转页面', exact: true}).click();
  await expect(page.getByRole('button', {name: '撤销', exact: true})).toBeEnabled();
  const output = path.join(temp, '另存 合同.pdf');
  await app.evaluate(({dialog}, file) => { dialog.showSaveDialog = async () => ({canceled: false, filePath: file}); }, output);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  await expect.poll(async () => (await fs.stat(output).catch(() => null))?.size || 0).toBeGreaterThan(100);
  const reopened = await page.evaluate(async data => {
    const d = await window.studio.rpc('open', {data, name: '保存重开.pdf'});
    try { return {pages: d.pages.length, rotation: d.pages[0].rotation}; }
    finally { await window.studio.rpc('close', {sid: d.id}); }
  }, await fs.readFile(output, 'base64'));
  expect(reopened).toEqual({pages: 3, rotation: 90});
  const scan = await fs.readFile('test-fixtures/ocr-batch.pdf', 'base64');
  const ocr = await page.evaluate(async data => {
    const d = await window.studio.rpc('open', {data, name: '扫描.pdf'});
    try {
      const p = await window.studio.rpc('preview', {sid: d.id, operations: [{type: 'ocr', page: 0}]});
      await window.studio.rpc('commit', {sid: d.id, token: p.token});
      const objects = await window.studio.rpc('objects', {sid: d.id, page: 0});
      return {diff: p.diff, text: objects.texts.map(x => x.text).join('')};
    } finally { await window.studio.rpc('close', {sid: d.id}); }
  }, scan);
  expect(ocr.diff).toEqual([]);
  expect(ocr.text).toContain('中文文字识别测试');
  expect(ocr.text).toContain('OpenPDF');
  const conversions = await page.evaluate(async data => {
    const d = await window.studio.rpc('open', {data});
    try {
      const results = [];
      for (const format of ['docx', 'xlsx', 'pptx', 'png', 'txt']) {
        const result = await window.studio.rpc('export', {sid: d.id, format});
        results.push({format, size: result.data.length});
      }
      return results;
    } finally { await window.studio.rpc('close', {sid: d.id}); }
  }, await fs.readFile(fixture, 'base64'));
  for (const result of conversions) expect(result.size).toBeGreaterThan(10);
  const highResolution = await page.evaluate(async data => {
    const d = await window.studio.rpc('open', {data});
    try { return await window.studio.rpc('export', {sid: d.id, format: 'png', pages: [0], dpi: 600}); }
    finally { await window.studio.rpc('close', {sid: d.id}); }
  }, await fs.readFile(fixture, 'base64'));
  const imageZip = path.join(temp, '高清图片.zip');
  await fs.writeFile(imageZip, Buffer.from(highResolution.data, 'base64'));
  // Independent file readback verifies the frozen worker rendered real pixels and wrote DPI metadata.
  const imageReadback = JSON.parse(execFileSync(pythonPath(root), ['-X', 'utf8', '-c',
    'import sys,json,io,zipfile;from PIL import Image;z=zipfile.ZipFile(sys.argv[1]);im=Image.open(io.BytesIO(z.read("page-1.png")));print(json.dumps({"size":list(im.size),"dpi":[round(x) for x in im.info["dpi"]]}))', imageZip], {encoding: 'utf8'}));
  expect(imageReadback).toEqual({size: [4959, 7017], dpi: [600, 600]});
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  const evidence = process.env.OPENPDF_EVIDENCE || path.join(os.tmpdir(), 'openpdf-evidence');
  await fs.mkdir(evidence, {recursive: true});
  await page.screenshot({path: path.join(evidence, `portable-${process.platform}.png`)});
  console.log(JSON.stringify({runtime, unicodePath: true, saveReopen: reopened, offlineOcr: true, conversions, highResolutionPng: imageReadback, errors}, null, 2));
} finally {
  if (app) await app.close();
  await fs.rm(temp, {recursive: true, force: true, maxRetries: 5, retryDelay: 500});
}
