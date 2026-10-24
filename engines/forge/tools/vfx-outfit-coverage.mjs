// Verify the generated local FX graph against its actual file list. No game resources are written or downloaded.
import fs from 'node:fs/promises';
import path from 'node:path';
import { familyOf } from '../public/js/render/vfx/materials.js';

const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
for (const name of ['--index', '--manifest', '--assets', '--out']) if (!args.includes(name)) throw Error(`Required ${name}`);
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const index = await read(option('--index')), manifest = await read(option('--manifest'));
const roots = [option('--assets'), ...(args.includes('--fallback') ? [option('--fallback')] : [])].map(p => path.resolve(p));
const missingFiles = [], invalidFiles = [], missingTextures = [], missingMeshes = [], missingReferences = [];
const shaderFallbacks = {}, descriptors = [], checked = new Set();
const locate = async url => {
  if (typeof url !== 'string' || !url.startsWith('/assets/')) return null;
  const rel = url.slice('/assets/'.length);
  for (const root of roots) {
    const p = path.resolve(root, rel);
    if (!p.startsWith(root + path.sep)) continue;
    try { if ((await fs.stat(p)).isFile()) return p; } catch { /* next layer */ }
  }
  return null;
};
for (const [group, entries] of Object.entries(manifest.groups || {})) for (const [key, entry] of Object.entries(entries)) {
  if (checked.has(entry.path)) continue;
  checked.add(entry.path);
  const p = await locate(entry.path);
  if (!p) { missingFiles.push({ group, key, path: entry.path }); continue; }
  try {
    const stat = await fs.stat(p);
    if (!stat.size) throw Error('empty file');
    if (p.endsWith('.json')) {
      const data = await read(p);
      if (group === 'fx/prefabs') descriptors.push(data);
    } else if (p.endsWith('.webp')) {
      const f = await fs.open(p, 'r');
      const header = Buffer.alloc(12); await f.read(header, 0, 12, 0); await f.close();
      if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WEBP') throw Error('invalid WebP header');
    }
  } catch (e) { invalidFiles.push({ path: entry.path, error: e.message }); }
}
for (const d of descriptors) {
  for (const k of Array.isArray(d.textures) ? d.textures : Object.keys(d.textures || {})) if (!manifest.groups?.['fx/tex']?.[k]) missingTextures.push({ effect: d.key, key: k });
  for (const k of Array.isArray(d.meshes) ? d.meshes : Object.keys(d.meshes || {})) if (!k.startsWith('builtin:') && !manifest.groups?.['fx/mesh']?.[k]) missingMeshes.push({ effect: d.key, key: k });
  for (const k of d.refs || []) if (!index.prefabs?.[k] && k !== 'common_empty') missingReferences.push({ effect: d.key, key: k });
  for (const material of d.materials || []) if (material) {
    const family = familyOf(material.shader);
    if (family.fallback) {
      const row = shaderFallbacks[material.shader] ||= { family: family.family, materials: 0, effects: new Set() };
      row.materials++; row.effects.add(d.key);
    }
  }
}
for (const row of Object.values(shaderFallbacks)) row.effects = [...row.effects].sort();
const statuses = {};
for (const outfit of Object.values(index.outfits || {})) statuses[outfit.status] = (statuses[outfit.status] || 0) + 1;
const report = { checkedFiles: checked.size, checkedDescriptors: descriptors.length, outfits: Object.keys(index.outfits || {}).length, statuses,
  missingFiles, invalidFiles, missingTextures, missingMeshes, missingReferences, shaderFallbacks };
await fs.mkdir(path.dirname(path.resolve(option('--out'))), { recursive: true });
await fs.writeFile(option('--out'), JSON.stringify(report, null, 2) + '\n');
if (args.includes('--summary')) {
  const summary = { format: 'outfit-fx-coverage', version: 1, scope: 'installed wardrobe; official prefab mappings and reachable resource closure',
    outfits: report.outfits, statuses, checkedFiles: report.checkedFiles, checkedDescriptors: descriptors.length,
    integrity: { missingFiles: missingFiles.length, invalidFiles: invalidFiles.length, missingTextures: missingTextures.length,
      missingMeshes: missingMeshes.length, missingReferences: missingReferences.length },
    shaderFallbacks: Object.fromEntries(Object.entries(shaderFallbacks).map(([shader, row]) => [shader, { family: row.family, materials: row.materials, effects: row.effects.length }])),
    skins: Object.entries(index.outfits || {}).map(([skinId, o]) => ({ skinId, charId: o.charId, status: o.status,
      replacementPairs: Object.keys(o.replacements || {}).length, tokenLooks: Object.keys(o.tokenLooks || {}).length,
      missingEffects: o.missingEffects || [], missingTokenUnits: o.missingTokenUnits || [],
      unsupportedConfigFields: o.unsupportedConfigFields || [], unreachableReplacementTargets: o.unreachableReplacementTargets || [] })) };
  await fs.mkdir(path.dirname(path.resolve(option('--summary'))), { recursive: true });
  await fs.writeFile(option('--summary'), JSON.stringify(summary, null, 2) + '\n');
}
console.log(JSON.stringify({ ...report, shaderFallbacks: Object.keys(shaderFallbacks).length }));
if (missingFiles.length || invalidFiles.length || missingTextures.length || missingMeshes.length || missingReferences.length) process.exitCode = 1;
