// Reviewed 2026-11-09 against official Node / Electron release metadata.
// Recheck official advisories before each release; this is not a timeless safety claim.
const https = require('node:https');
const {execFileSync} = require('node:child_process');
const floors = {24:[24,22,2],26:[26,13,0]};
function patched(value) {
 const v=value.replace(/^v/,'').split('.').map(Number), min=floors[v[0]];
 if(!min || v.length!==3 || v.some(x=>!Number.isInteger(x)))return false;
 return v.some((x,i)=>x>min[i]&&v.slice(0,i).every((y,j)=>y===min[j]))||v.every((x,i)=>x===min[i]);
}
function json(url) {return new Promise((resolve,reject)=>https.get(url,{timeout:20000},r=>{
 if(r.statusCode!==200){r.resume();reject(new Error(`HTTP ${r.statusCode}`));return;}
 let body='';r.on('data',b=>body+=b);r.on('end',()=>{try{resolve(JSON.parse(body))}catch(e){reject(e)}});
}).on('error',reject).on('timeout',function(){this.destroy(new Error('Official release lookup timed out'))}));}
async function main(){
 if(!patched(process.versions.node))throw new Error(`Node ${process.versions.node} is below the reviewed security baseline. See docs/runtime-security.md.`);
 console.log(`Build Node: ${process.versions.node}`);
 if(process.argv.includes('--electron')){
  const version=require('../package.json').devDependencies.electron;
  const rows=await json('https://releases.electronjs.org/releases.json');
  const found=rows.find(x=>x.version===version);
  if(!found)throw new Error(`Cannot verify Electron ${version} from official release metadata.`);
  console.log(`Electron ${version} embeds Node ${found.node}`);
  if(!patched(found.node))throw new Error('Desktop launch/package blocked: embedded Node lacks the reviewed patch version. Update Electron after upstream fixes are available; see docs/runtime-security.md.');
  if(process.argv.includes('--installed')){
   const installed=require('electron/package.json').version;
   if(installed!==version)throw new Error(`Installed Electron ${installed} does not match pin ${version}. Run npm ci.`);
   const actual=JSON.parse(execFileSync(require('electron'),['-p','JSON.stringify(process.versions)'],{encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},timeout:20000,windowsHide:true}));
   console.log(`Installed Electron: ${actual.electron}; embedded Node: ${actual.node}; Chromium: ${actual.chrome}`);
   if(actual.electron!==version||!patched(actual.node))throw new Error('Installed Electron runtime did not pass verification.');
  }
 }
}
module.exports={patched};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
