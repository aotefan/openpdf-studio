const path = require('node:path');
const {pathToFileURL} = require('node:url');

function pythonPath(root, platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  return paths.join(root, '.venv', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}

function workerLaunch({root, resources, packaged, platform = process.platform, env = process.env}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const windows = platform === 'win32';
  return {
    command: packaged ? paths.join(resources, 'engine', windows ? 'openpdf-engine.exe' : 'openpdf-engine') : pythonPath(root, platform),
    args: packaged ? [] : ['-X', 'utf8', paths.join(root, 'engine', 'worker.py')],
    options: {
      cwd: packaged ? resources : root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {...env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
        OPENPDF_OCR_BACKEND: windows ? 'rapidocr' : 'vision',
        OPENPDF_OCR: paths.join(packaged ? resources : paths.join(root, 'build'), 'vision-ocr')},
    },
  };
}

function isAppNavigation(url, entry) {
  try {
    const target = new URL(url);
    target.hash = '';
    return target.href === pathToFileURL(entry).href;
  } catch { return false; }
}

module.exports = {pythonPath, workerLaunch, isAppNavigation};
