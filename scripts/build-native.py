"""Build the worker on the target OS. PyInstaller cannot cross-compile it."""
import importlib.metadata
import json
import platform
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'build'


def main():
    if sys.platform not in ('darwin', 'win32'):
        raise SystemExit('Supported build hosts: macOS and Windows x64.')
    if sys.platform == 'win32' and platform.machine().lower() not in ('amd64', 'x86_64'):
        raise SystemExit('The Windows preview currently requires an x64 Python interpreter.')
    BUILD.mkdir(exist_ok=True)
    icon = Image.new('RGBA', (1024, 1024))
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle((36, 36, 988, 988), radius=210, fill=(48, 94, 196))
    draw.line([(300, 784), (300, 240), (590, 240), (740, 390), (740, 784), (300, 784)], fill='white', width=35, joint='curve')
    draw.line([(590, 240), (590, 390), (740, 390)], fill='white', width=32)
    for y, end in [(499, 650), (599, 650), (699, 555)]:
        draw.line([(390, y), (end, y)], fill='white', width=28)
    icon.save(BUILD / ('OpenPDF.ico' if sys.platform == 'win32' else 'OpenPDF.icns'))
    args = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--console',
            '--name', 'openpdf-engine', '--distpath', str(BUILD / 'engine-dist'),
            '--workpath', str(BUILD / 'engine-work'), '--specpath', str(BUILD),
            '--collect-all', 'pymupdf', '--collect-all', 'docx', '--collect-all', 'pptx']
    if sys.platform == 'win32':
        for package in ['rapidocr_onnxruntime', 'onnxruntime', 'cv2', 'shapely', 'pyclipper']:
            args += ['--collect-all', package]
        for package in ['rapidocr-onnxruntime', 'onnxruntime', 'opencv-python', 'numpy', 'shapely', 'pyclipper', 'PyYAML', 'pillow']:
            args += ['--copy-metadata', package]
    else:
        args += ['--exclude-module', 'rapidocr_onnxruntime', '--exclude-module', 'onnxruntime', '--exclude-module', 'cv2']
        subprocess.run(['swiftc', '-target', f'{platform.machine()}-apple-macos14.0',
                        str(ROOT / 'src/ocr/vision.swift'), '-o', str(BUILD / 'vision-ocr')], check=True)
    args.append(str(ROOT / 'engine/worker.py'))
    subprocess.run(args, cwd=ROOT, check=True)
    manifest = {'platform': sys.platform, 'arch': platform.machine(), 'python': platform.python_version(),
                'packages': {d.metadata['Name']: d.version for d in importlib.metadata.distributions()}}
    (BUILD / 'engine-dist/openpdf-engine/build-info.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
