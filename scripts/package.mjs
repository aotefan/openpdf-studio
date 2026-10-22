import {packager} from '@electron/packager';import {execFileSync} from 'node:child_process';import fs from 'node:fs/promises';import path from 'node:path';
const root=process.cwd(),stage=path.join(root,'build/staging');
const {version,devDependencies}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
await fs.rm(stage,{recursive:true,force:true});
await fs.mkdir(stage,{recursive:true});
for(const name of ['dist','desktop'])await fs.cp(path.join(root,name),path.join(stage,name),{recursive:true});
const source=path.join(stage,'source');await fs.mkdir(source,{recursive:true});
for(const name of ['src','engine','scripts','docs','tests','README.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md','requirements.txt','package-lock.json','package.json','playwright.config.ts','test-fixtures','tsconfig.json','vite.config.ts','index.html']){
 try{await fs.cp(path.join(root,name),path.join(source,name),{recursive:true,filter:p=>!p.includes('/results/')&&!p.includes('__pycache__')});}catch(e){if(e.code!=='ENOENT')throw e}
}
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:'openpdf-studio',version,main:'desktop/main.cjs',author:'OpenPDF Studio contributors',license:'AGPL-3.0-or-later'}));
const outputs=await packager({dir:stage,out:path.join(root,'release/artifacts.noindex',version),name:'OpenPDF Studio',icon:path.join(root,'build/OpenPDF.icns'),platform:'darwin',arch:'arm64',electronVersion:devDependencies.electron,overwrite:true,prune:false,appBundleId:'studio.openpdf.desktop',appVersion:version,asar:false});
const resources=path.join(outputs[0],'OpenPDF Studio.app/Contents/Resources');
await fs.cp(path.join(root,'build/engine-dist/openpdf-engine'),path.join(resources,'engine'),{recursive:true,verbatimSymlinks:true});
await fs.copyFile(path.join(root,'build/vision-ocr'),path.join(resources,'vision-ocr'));
const bundle=path.join(outputs[0],'OpenPDF Studio.app');
execFileSync('codesign',['--force','--deep','--sign','-','--preserve-metadata=entitlements',bundle],{stdio:'inherit'});
execFileSync('codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});
console.log(outputs[0]);
