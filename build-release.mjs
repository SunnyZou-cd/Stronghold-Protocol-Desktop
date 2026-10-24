import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Usage: node build-release.mjs full|source|no-assets [--zip] [--out <new-directory>]
// Sources are read only. Each invocation creates a NEW output folder.
const work = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
if (!['full', 'source', 'no-assets'].includes(mode)) throw Error('Choose full, source or no-assets');
const desktop = process.env.SP_DESKTOP_SOURCE || (fs.existsSync(path.join(work, 'engines/forge/server/index.js')) ? work : 'C:/codex/Stronghold-Desktop');
const engine = process.env.SP_ENGINE_SOURCE || path.join(desktop, 'engines/forge');
const template = process.env.SP_WRAPPER_SOURCE || path.join(work, 'desktop');
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0 && !process.argv[outIndex + 1]) throw Error('--out requires a directory');
const dest = outIndex >= 0 ? path.resolve(process.argv[outIndex + 1]) : path.join(work, `Stronghold-Protocol-${mode}-20261023`);
if (dest === path.resolve(desktop) || dest === path.resolve(engine) || dest.startsWith(path.resolve(engine) + path.sep)) throw Error('Output cannot overwrite or nest inside the engine');
if (fs.existsSync(dest)) throw Error(`Output already exists; preserve or rename it before rebuilding: ${dest}`);
const sourceOnly = mode === 'source';
const omitArt = mode !== 'full';
const builtinPlugins=['lele-damage','lele-factions','lele-lucky','lele-operators','lele-recruits','lele-relics','lele-rounds','lele-targeted'];
const excludedDirs = new Set(['.git', '.cache', '.venv-extract', 'state', 'var', 'logs', 'diagnostics', 'electron-cache', 'npm-cache', '.vscode', '.idea', '__pycache__', '_removed', '_moved', '_dist']);
const excludedFile = n => /^\.env(?:\.|$)/.test(n) || /(?:\.log|\.rej|\.orig|\.pem|\.key|\.p12|\.pyc)$/.test(n) || n === '.studio-key' || n === 'service.env.cmd' || n === '.DS_Store' || n === 'Thumbs.db';
let files = 0, bytes = 0;
function copyTree(from, to, rel = '', engineTree = false) {
  for (const item of fs.readdirSync(from, { withFileTypes: true })) {
    const r = [rel, item.name].filter(Boolean).join('/');
    if (item.isSymbolicLink()) throw Error(`Refusing symlink: ${from}/${item.name}`);
    if (excludedFile(item.name) || (item.isDirectory() && excludedDirs.has(item.name))) continue;
    if (sourceOnly && item.name === 'node_modules') continue;
    if (sourceOnly && engineTree && rel === 'plugins' && item.isDirectory() && item.name !== '_template' && !builtinPlugins.includes(item.name)) continue;
    if (omitArt && engineTree && /^data\/local-(?:assets|fx)\.json$/.test(r)) continue;
    if (engineTree && (/^(?:test\/e2e\/out|public\/dev\/simcheck\/data)(?:\/|$)/.test(r) || /^(?:build|dist)(?:\/|$)/.test(r))) continue;
    // Includes workshop art and screenshots, plus the upstream official-derived faction logo.
    if (omitArt && engineTree && (/^(?:public\/(?:assets|fonts|art)|docs\/img)(?:\/|$)/.test(r) || /(?:^|\/)assets(?:\/|$)/.test(r) || /\.(?:png|jpe?g|webp|gif|avif|ico|skel|atlas|ogg|mp3|wav|mp4|webm|glb|gltf|fbx|ttf|otf|woff2?)$/i.test(r))) continue;
    const src = path.join(from, item.name), target = path.join(to, item.name);
    if (item.isDirectory()) { fs.mkdirSync(target, { recursive: true }); copyTree(src, target, r, engineTree); }
    else if (item.isFile()) { fs.mkdirSync(to, { recursive: true }); fs.copyFileSync(src, target); files++; bytes += fs.statSync(src).size; }
  }
}
fs.mkdirSync(dest, { recursive: true });
for (const name of ['main.cjs', 'server-host.mjs', 'Launcher.cs', 'package.json', 'package-lock.json']) fs.copyFileSync(path.join(template, name), path.join(dest, name));
fs.writeFileSync(path.join(dest, 'config.json'), JSON.stringify({ gameRoot: 'engines/forge', port: 31371 }, null, 2) + '\n');
if (!sourceOnly) {
  fs.copyFileSync(path.join(template, '启动卫戍协议.vbs'), path.join(dest, '启动卫戍协议.vbs'));
  const compiler = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const compile = spawnSync(compiler, ['/nologo', '/target:winexe', '/reference:System.Windows.Forms.dll', `/out:${path.join(dest, 'Stronghold-Protocol.exe')}`, path.join(dest, 'Launcher.cs')], { stdio: 'inherit', windowsHide: true });
  if (compile.status !== 0) throw Error(`Launcher compile failed: ${compile.status}`);
  copyTree(path.join(desktop, 'node_modules'), path.join(dest, 'node_modules'));
  copyTree(path.join(template, 'licenses'), path.join(dest, 'licenses'));
  if (!omitArt) fs.copyFileSync(path.join(desktop, 'SP_ico.ico'), path.join(dest, 'SP_ico.ico'));
}
copyTree(engine, path.join(dest, 'engines/forge'), '', true);
if (sourceOnly) {
  // These bundled source packs are intentionally ignored by the upstream
  // server checkout. Allow only our known built-ins in the NEW source snapshot.
  const allow=builtinPlugins.filter(id=>fs.existsSync(path.join(dest,'engines/forge/plugins',id)))
    .flatMap(id=>[`!plugins/${id}/`,`!plugins/${id}/**`]);
  if(allow.length)fs.appendFileSync(path.join(dest,'engines/forge/.gitignore'),'\n# Bundled desktop plugin source (keep unknown personal server plugins ignored)\n'+allow.join('\n')+'\n');
}
for (const name of ['LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md']) fs.copyFileSync(path.join(engine, name), path.join(dest, name));
for (const name of ['build-release.mjs', 'verify-release.mjs', 'audit-release.mjs', 'import-local-assets.mjs', 'RELEASE-NOTES.md']) if (fs.existsSync(path.join(work, name))) fs.copyFileSync(path.join(work, name), path.join(dest, name));
copyTree(template, path.join(dest, 'desktop'));
fs.copyFileSync(path.join(work, 'README-PUBLIC.md'), path.join(dest, 'README.md'));
fs.copyFileSync(path.join(work, 'README-PUBLIC.md'), path.join(dest, 'README-PUBLIC.md'));
const ignoreSource=fs.existsSync(path.join(work,'ROOT-GITIGNORE'))?path.join(work,'ROOT-GITIGNORE'):path.join(work,'.gitignore');
fs.copyFileSync(ignoreSource,path.join(dest,'.gitignore'));
fs.copyFileSync(ignoreSource,path.join(dest,'ROOT-GITIGNORE'));
const manifest = [];
async function scan(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    const r = [rel, entry.name].filter(Boolean).join('/'), p = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(p, r);
    else { const hash = crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(p)) hash.update(chunk); manifest.push({ path: r, bytes: fs.statSync(p).size, sha256: hash.digest('hex') }); }
  }
}
await scan(dest);
fs.writeFileSync(path.join(dest, 'FILE-MANIFEST.json'), JSON.stringify({ mode, files: manifest }, null, 2));
fs.writeFileSync(path.join(work, `build-${mode}.json`), JSON.stringify({ mode, dest, fileCount: manifest.length, bytes: manifest.reduce((s,f)=>s+f.bytes,0), engine, desktop }, null, 2));
if (process.argv.includes('--zip')) {
  const zip = `${dest}-win-x64.zip`;
  const result = spawnSync('7z', ['a', '-tzip', '-mx=5', zip, path.basename(dest)], { cwd: path.dirname(dest), stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw Error(`7z failed: ${result.status}`);
  const hash = crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(zip)) hash.update(chunk);
  fs.writeFileSync(`${zip}.sha256`, `${hash.digest('hex')}  ${path.basename(zip)}\n`);
}
console.log(JSON.stringify({ mode, dest, files: manifest.length, bytes: manifest.reduce((s,f)=>s+f.bytes,0) }));
