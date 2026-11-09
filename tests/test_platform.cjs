const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {workerLaunch, pythonPath, isAppNavigation} = require('../desktop/platform.cjs');
const {WorkerClient} = require('../desktop/worker-client.cjs');

test('Windows worker uses bundled exe or virtualenv and UTF-8 without a console', () => {
  const root = 'C:\\工作 区\\OpenPDF';
  const resources = 'C:\\Program Files\\OpenPDF\\resources';
  const dev = workerLaunch({root, resources, packaged: false, platform: 'win32', env: {LANG: 'zh_CN'}});
  assert.equal(dev.command, root + '\\.venv\\Scripts\\python.exe');
  assert.deepEqual(dev.args, ['-X', 'utf8', root + '\\engine\\worker.py']);
  assert.equal(dev.options.windowsHide, true);
  assert.equal(dev.options.env.PYTHONIOENCODING, 'utf-8');
  assert.equal(dev.options.env.OPENPDF_OCR_BACKEND, 'rapidocr');
  const packaged = workerLaunch({root, resources, packaged: true, platform: 'win32'});
  assert.equal(packaged.command, resources + '\\engine\\openpdf-engine.exe');
  assert.deepEqual(packaged.args, []);
});

test('macOS keeps native Vision and bundled worker paths', () => {
  const launch = workerLaunch({root: '/工作 区/app', resources: '/Applications/OpenPDF.app/Contents/Resources', packaged: true, platform: 'darwin'});
  assert.equal(launch.options.env.OPENPDF_OCR_BACKEND, 'vision');
  assert.match(launch.options.env.OPENPDF_OCR, /Resources\/vision-ocr$/);
  assert.equal(pythonPath('/project', 'darwin'), '/project/.venv/bin/python');
});

test('navigation accepts encoded local entry, rejects sibling-prefix and remote pages', () => {
  const entry = path.join(os.tmpdir(), 'OpenPDF 中文 空格', 'dist', 'index.html');
  const url = pathToFileURL(entry).href;
  assert.equal(isAppNavigation(url, entry), true);
  assert.equal(isAppNavigation(url + '#page=2', entry), true);
  for (const other of [url + '.evil', pathToFileURL(path.join(path.dirname(entry), '..', 'dist-evil', 'index.html')).href, 'https://example.com', 'not a URL']) {
    assert.equal(isAppNavigation(other, entry), false);
  }
});

test('worker spawn failure rejects pending and future requests', {timeout: 5000}, async t => {
  const client = new WorkerClient({command: path.join(os.tmpdir(), 'missing-openpdf-worker-' + Date.now()), args: [], options: {stdio: ['pipe', 'pipe', 'pipe']}});
  t.after(() => client.kill());
  await assert.rejects(client.call('open'), /engineStopped/);
  await assert.rejects(client.call('open'), /engineStopped/);
});

test('worker UTF-8 response survives a Chinese filename; later exit cannot hang RPC', {timeout: 5000}, async t => {
  const program = `const readline=require('node:readline');readline.createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(r.method==='die')process.exit(1);console.log(JSON.stringify({id:r.id,result:r.params}));});`;
  const client = new WorkerClient({command: process.execPath, args: ['-e', program], options: {stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true}});
  t.after(() => client.kill());
  assert.deepEqual(await client.call('echo', {name: '合同 中文.pdf'}), {name: '合同 中文.pdf'});
  await assert.rejects(client.call('die'), /engineStopped/);
  await assert.rejects(client.call('echo'), /engineStopped/);
});
