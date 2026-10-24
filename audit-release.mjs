import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const report={root,files:0,oversize:[],secretPaths:[],absoluteLocalPaths:[],artPaths:[]};
const secrets=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35})/;
const textExtensions=/\.(?:[cm]?js|jsx|ts|tsx|json|jsonl|md|txt|yaml|yml|html|css|py|ps1|cmd|bat|vbs|cs|toml|xml|ini)$/i;
function walk(dir,rel=''){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(e.name==='.git'||e.name==='node_modules')continue;
  const r=[rel,e.name].filter(Boolean).join('/'),p=path.join(dir,e.name);
  if(e.isDirectory()){walk(p,r);continue;}if(!e.isFile())continue;
  report.files++;const size=fs.statSync(p).size;
  if(size>=100*1024*1024)report.oversize.push(r);
  if(/(?:^|\/)(?:public\/(?:assets|art|fonts)|docs\/img)(?:\/|$)/.test(r))report.artPaths.push(r);
  if(size>16*1024*1024||!textExtensions.test(e.name))continue;
  const data=fs.readFileSync(p,'utf8');
  if(secrets.test(data))report.secretPaths.push(r);
  // Paths are reported for review; a documentation example is not a secret.
  if(/\b[A-Z]:[\\/](?:Users|codex|Program1)[\\/]/i.test(data))report.absoluteLocalPaths.push(r);
 }
}
walk(root);
report.ok=!report.oversize.length&&!report.secretPaths.length&&!report.artPaths.length;
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
