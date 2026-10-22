// Minimum patched versions from the 2026-10-21 Node security advisory.
// Recheck official advisories before each release; this is not a timeless safety claim.
const https = require('node:https');
const floors = {22:[22,23,4],24:[24,22,1],26:[26,12,1]};
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
 }
}
module.exports={patched};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
