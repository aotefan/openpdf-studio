import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {patched} = require('./check-runtime.cjs');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Build the macOS Apple Silicon DMG on an Apple Silicon Mac.');
const {version, devDependencies} = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
execFileSync(process.execPath, [path.join(root, 'scripts/check-runtime.cjs'), '--electron', '--installed'], {stdio: 'inherit'});
const output = path.join(root, 'release/artifacts.noindex', version);
const app = path.join(output, 'OpenPDF Studio-darwin-arm64/OpenPDF Studio.app');
const appVersion = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleShortVersionString', path.join(app, 'Contents/Info.plist')], {encoding: 'utf8'}).trim();
if (appVersion !== version) throw new Error('The app version differs from package.json. Run npm run package first.');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], {stdio: 'inherit'});
execFileSync(process.execPath, [path.join(root, 'scripts/python.cjs'), path.join(root, 'scripts/check-macos-target.py'), app], {stdio: 'inherit'});
const executable = path.join(app, 'Contents/MacOS/OpenPDF Studio');
const architectures = execFileSync('lipo', ['-archs', executable], {encoding: 'utf8'}).trim();
if (architectures !== 'arm64') throw new Error(`Unexpected app architecture: ${architectures}`);
const runtime = JSON.parse(execFileSync(executable, ['-p', 'JSON.stringify(process.versions)'], {encoding: 'utf8', env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}, timeout: 20000}));
if (runtime.electron !== devDependencies.electron || !patched(runtime.node)) throw new Error('The packaged runtime failed verification.');

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'openpdf-dmg-'));
const target = path.join(output, `OpenPDF-Studio-${version}-macos-arm64.dmg`);
try {
  const stage = path.join(temp, 'contents');
  await fs.mkdir(stage);
  execFileSync('ditto', [app, path.join(stage, 'OpenPDF Studio.app')], {stdio: 'inherit'});
  await fs.symlink('/Applications', path.join(stage, 'Applications'));
  await fs.writeFile(path.join(stage, '安装说明 - Read Me.txt'), `OpenPDF Studio ${version} — macOS Apple Silicon (M-series chips)

安装：将 OpenPDF Studio.app 拖到 Applications（应用程序），再从应用程序打开。
Install: drag OpenPDF Studio.app to Applications, then open it from Applications.

无需安装 Node、Python 或 Office。文档在本机处理。
No separate Node, Python or Office installation is needed. PDFs stay on your computer.

当前是未经 Apple Developer ID 签名或公证的预览版，首次打开可能受到系统限制。
This preview is not Developer ID signed or notarized; macOS may block the first launch.
安装帮助 / Installation help:
https://github.com/aotefan/openpdf-studio/blob/main/docs/macos.md

适用于 macOS 14 或更高版本的 Apple Silicon Mac；不支持 Intel Mac。
For Apple Silicon Macs running macOS 14 or later; Intel Macs are not supported.

源码及许可 / Source and license:
https://github.com/aotefan/openpdf-studio
AGPL-3.0-or-later. Corresponding source and third-party notices are bundled inside the app.
`);
  const image = path.join(temp, 'OpenPDF.dmg');
  execFileSync('hdiutil', ['create', '-srcfolder', stage, '-volname', `OpenPDF Studio ${version}`, '-fs', 'HFS+', '-format', 'UDZO', image], {stdio: 'inherit'});
  execFileSync('hdiutil', ['verify', image], {stdio: 'inherit'});
  // Fail rather than replacing an already-published release file.
  await fs.copyFile(image, target, fs.constants.COPYFILE_EXCL);
  const hash = createHash('sha256').update(await fs.readFile(target)).digest('hex');
  await fs.writeFile(target + '.sha256', `${hash}  ${path.basename(target)}\n`);
  console.log(JSON.stringify({file: target, size: (await fs.stat(target)).size, sha256: hash, electron: runtime.electron, node: runtime.node}, null, 2));
} finally {
  await fs.rm(temp, {recursive: true, force: true});
}
