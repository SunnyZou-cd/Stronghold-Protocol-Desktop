import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve(process.argv[2] || '.');
const report = { root, checks: [], missing: [], changed: [] };
function check(name, ok) { report.checks.push({name,passed:!!ok}); assert.ok(ok, name); }
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'FILE-MANIFEST.json'),'utf8'));
  check('no personal state or git history', !fs.existsSync(path.join(root,'state')) && !fs.existsSync(path.join(root,'engines/forge/.git')));
  const forbidden = manifest.files.filter(f=>/(?:^|\/)(?:\.git|\.cache|state|var|\.studio-key|\.env)(?:\/|$)/.test(f.path));
  report.forbidden = forbidden.map(f=>f.path); check('manifest excludes secrets and local state',!forbidden.length);
  for (const f of manifest.files) {
    const p=path.join(root,f.path);if(!fs.existsSync(p)){report.missing.push(f.path);continue;}
    const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(p))hash.update(chunk);
    if(hash.digest('hex')!==f.sha256)report.changed.push(f.path);
  }
  check('all manifest files match SHA256',!report.missing.length&&!report.changed.length);
  report.fileCount=manifest.files.length;
  const config=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
  check('portable relative game root',!path.isAbsolute(config.gameRoot));
  check('portable wrapper resolves relative path',fs.readFileSync(path.join(root,'main.cjs'),'utf8').includes('path.resolve(base, config.gameRoot)'));
  check('license notices present',['LICENSE','NOTICE.md','THIRD-PARTY-NOTICES.md'].every(n=>fs.existsSync(path.join(root,n))));
  if(manifest.mode==='full') {
    const assets=new Set();
    const walk=v=>{if(typeof v==='string'&&v.startsWith('/assets/'))assets.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
    const local=JSON.parse(fs.readFileSync(path.join(root,'engines/forge/data/local-assets.json'),'utf8'));walk(local);
    report.localAssetPaths=assets.size;
    report.absentAssets=[...assets].filter(p=>!fs.existsSync(path.join(root,'engines/forge/public',p)));
    report.skinCount=Object.values(local.chars||{}).reduce((n,c)=>n+Object.keys(c.skins||{}).length,0);
    check('indexed local assets present',assets.size>1000&&!report.absentAssets.length);
    check('at least 303 outfits present',report.skinCount>=303);
  } else {
    check('public archive excludes official art roots',!fs.existsSync(path.join(root,'engines/forge/public/assets'))&&!fs.existsSync(path.join(root,'engines/forge/public/art'))&&!fs.existsSync(path.join(root,'engines/forge/docs/img')));
  }
  report.ok=true;
} catch(error) { report.ok=false;report.error=error.stack;process.exitCode=1; }
console.log(JSON.stringify(report,null,2));
