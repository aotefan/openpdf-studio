const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {pythonPath} = require('../desktop/platform.cjs');
const root = path.resolve(__dirname, '..');
const result = spawnSync(pythonPath(root), ['-X', 'utf8', ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', env: {...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'},
});
if (result.error) console.error(`Python environment unavailable: ${result.error.message}. See docs/windows.md.`);
process.exitCode = result.status ?? 1;
