import {packager} from '@electron/packager';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import platformPaths from '../desktop/platform.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(x => x.startsWith('--platform='))?.split('=')[1] || process.platform;
if (!['darwin', 'win32'].includes(target) || target !== process.platform) {
  throw new Error('Build Windows on Windows and macOS on macOS: the bundled Python worker is native. See docs/windows.md.');
}
if (target === 'win32' && process.arch !== 'x64') throw new Error('The Windows preview targets x64. Use x64 Node and Python.');
const runNode = (...args) => execFileSync(process.execPath, args, {cwd: root, stdio: 'inherit'});
runNode('scripts/check-runtime.cjs', '--electron', '--installed');
runNode('node_modules/typescript/bin/tsc', '-b');
runNode('node_modules/vite/bin/vite.js', 'build');
runNode('scripts/python.cjs', 'scripts/build-native.py');

const {version, devDependencies} = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const stage = path.join(root, 'build', `staging-${target}-${process.arch}`);
await fs.rm(stage, {recursive: true, force: true});
await fs.mkdir(stage, {recursive: true});
for (const name of ['dist', 'desktop']) await fs.cp(path.join(root, name), path.join(stage, name), {recursive: true});
const source = path.join(stage, 'source');
await fs.mkdir(source, {recursive: true});
const names = ['src', 'engine', 'site', '.gitignore', '.gitattributes', 'scripts', 'docs', 'tests', 'README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'requirements.txt', 'requirements-ocr.txt', 'requirements-windows.txt', 'requirements-windows.lock', 'package-lock.json', 'package.json', 'playwright.config.ts', 'test-fixtures', 'tsconfig.json', 'vite.config.ts', 'index.html', '.nvmrc', '.github', 'SECURITY.md', 'CONTRIBUTING.md'];
for (const name of names) {
  await fs.cp(path.join(root, name), path.join(source, name), {recursive: true, filter: file => {
    const parts = path.relative(root, file).split(path.sep);
    return !parts.includes('__pycache__') && !(parts[0] === 'tests' && parts[1] === 'results');
  }});
}
await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({name: 'openpdf-studio', version, main: 'desktop/main.cjs', author: 'OpenPDF Studio contributors', license: 'AGPL-3.0-or-later'}));
const [output] = await packager({dir: stage, out: path.join(root, 'release/artifacts.noindex', version),
  name: 'OpenPDF Studio', icon: path.join(root, 'build', target === 'win32' ? 'OpenPDF.ico' : 'OpenPDF.icns'),
  platform: target, arch: process.arch, electronVersion: devDependencies.electron, overwrite: true,
  prune: false, asar: false, appBundleId: 'studio.openpdf.desktop', appVersion: version,
  win32metadata: {CompanyName: 'OpenPDF Studio contributors', FileDescription: 'OpenPDF Studio', ProductName: 'OpenPDF Studio'},
});
const resources = target === 'win32' ? path.join(output, 'resources') : path.join(output, 'OpenPDF Studio.app/Contents/Resources');
await fs.cp(path.join(root, 'build/engine-dist/openpdf-engine'), path.join(resources, 'engine'), {recursive: true, verbatimSymlinks: true});
if (target === 'darwin') {
  await fs.copyFile(path.join(root, 'build/vision-ocr'), path.join(resources, 'vision-ocr'));
  const bundle = path.join(output, 'OpenPDF Studio.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--preserve-metadata=entitlements', bundle], {stdio: 'inherit'});
  execFileSync('codesign', ['--verify', '--deep', '--strict', bundle], {stdio: 'inherit'});
} else {
  const archive = path.join(path.dirname(output), `OpenPDF-Studio-${version}-windows-x64`);
  execFileSync(platformPaths.pythonPath(root), ['-X', 'utf8', '-c',
    'import shutil,sys;shutil.make_archive(sys.argv[1],"zip",root_dir=sys.argv[2],base_dir=sys.argv[3])',
    archive, path.dirname(output), path.basename(output)], {stdio: 'inherit'});
  console.log(`Portable ZIP: ${archive}.zip`);
}
console.log(output);
