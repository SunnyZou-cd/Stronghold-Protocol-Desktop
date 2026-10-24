import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Local-only recovery. No downloads, code, account state, keys or deletions.
const work = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function value(flag, fallback) {
  const i=args.indexOf(flag);
  if(i<0)return fallback;
  if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`${flag} requires a path`);
  return args[i+1];
}
const fromArg=value('--from',null);
if(!fromArg)throw Error('Usage: node import-local-assets.mjs --from <old engine> [--to <new engine>] [--dry-run]');
const from=path.resolve(fromArg),to=path.resolve(value('--to',path.join(work,'engines/forge')));
const dryRun=args.includes('--dry-run');
function rejectLinkChain(p) {
  let cursor=path.resolve(p);
  for(;;){
    let entry;try{entry=fs.lstatSync(cursor);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(entry?.isSymbolicLink())throw Error(`Symlink/junction refused: ${cursor}`);
    const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;
  }
}
for(const root of [from,to]){
  rejectLinkChain(root);
  const entry=path.join(root,'server/index.js');
  rejectLinkChain(entry);
  if(!fs.existsSync(entry)||!fs.statSync(entry).isFile())throw Error(`Not an engine directory (missing server/index.js): ${root}`);
}
const norm=p=>process.platform==='win32'?p.toLowerCase():p;
const a=norm(fs.realpathSync(from)),b=norm(fs.realpathSync(to));
if(a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep))throw Error('Source and target must be separate engine directories');
const roots=['public/assets','public/fonts','public/art','data/local-assets.json','data/local-fx.json'];
const workshop=path.join(from,'workshop');
if(fs.existsSync(workshop)){
  rejectLinkChain(workshop);
  for(const e of fs.readdirSync(workshop,{withFileTypes:true})){
    if(e.isSymbolicLink())throw Error(`Symlink/junction refused: ${path.join(workshop,e.name)}`);
    if(e.isDirectory())roots.push(`workshop/${e.name}/assets`);
  }
}
const forbidden=n=>/^\.env(?:\.|$)/.test(n)||n==='.studio-key'||/\.(?:[cm]?js|jsx|ts|tsx|py|pyc|ps1|bat|cmd|vbs|exe|dll|pem|key|p12)$/i.test(n);
const files=[];const skipped=[];
function plan(rel){
  const src=path.resolve(from,rel),dst=path.resolve(to,rel);
  if(!norm(src).startsWith(a+path.sep)||!norm(dst).startsWith(b+path.sep))throw Error(`Path escapes engine: ${rel}`);
  rejectLinkChain(src);rejectLinkChain(dst);
  let st;try{st=fs.lstatSync(src);}catch(error){if(error.code==='ENOENT')return;throw error;}
  if(st.isDirectory())for(const e of fs.readdirSync(src,{withFileTypes:true}))plan(path.join(rel,e.name));
  else if(st.isFile()){
    if(forbidden(path.basename(src))){skipped.push(rel);return;}
    if(fs.existsSync(dst)&&!fs.statSync(dst).isFile())throw Error(`Target is not a regular file: ${dst}`);
    files.push({rel,src,dst,bytes:st.size});
  }
}
for(const rel of roots)plan(rel);
if(!files.length)throw Error('No importable local assets found in the allowed source paths');
if(!dryRun)for(const file of files){
  // Repeat target link checks immediately before writing; existing assets are
  // replaced, while unknown files in the target are left alone.
  rejectLinkChain(file.dst);
  fs.mkdirSync(path.dirname(file.dst),{recursive:true});
  fs.copyFileSync(file.src,file.dst);
}
console.log(JSON.stringify({ok:true,dryRun,from,to,fileCount:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),
  copiedRoots:roots.filter(r=>files.some(f=>f.rel===r||f.rel.startsWith(path.normalize(r)+path.sep))),skippedPaths:skipped},null,2));
