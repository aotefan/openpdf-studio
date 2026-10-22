from pathlib import Path
import tempfile,shutil,subprocess,json
root=Path.cwd();version=json.loads((root/'package.json').read_text())['version'];source=root/'release/artifacts.noindex'/version/'OpenPDF Studio-darwin-arm64/OpenPDF Studio.app'
engine=root/'build/engine-dist';hidden=root/'build/engine-dist-portability-hidden'
with tempfile.TemporaryDirectory(prefix='openpdf-portable-') as tmp:
 app=Path(tmp)/'OpenPDF Studio.app';shutil.copytree(source,app,symlinks=True)
 engine.rename(hidden)
 try:
  p=subprocess.run(['node','scripts/test-packaged.mjs',str(app/'Contents/MacOS/OpenPDF Studio')],capture_output=True,text=True,timeout=150)
  Path('tests/results/portability.txt').write_text(p.stdout+p.stderr)
  report=json.loads(Path('tests/results/packaged-smoke.json').read_text());report['developmentEngineHidden']=True;report['exitCode']=p.returncode
  Path('tests/results/portability.json').write_text(json.dumps(report,indent=2))
  print(json.dumps(report,indent=2))
  if p.returncode:raise RuntimeError('Portable app smoke failed')
 finally:hidden.rename(engine)
