// Include every shipped workshop preset and stand-in in the ordinary asset plan.
// Data files remain generator outputs; no art metadata is authored in data/.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function collectOperatorRecords(value, out = {}) {
  if (!value || typeof value !== 'object') return out;
  if (/^char_\d+_[a-z0-9]+$/i.test(value.charId || '') && typeof value.name === 'string') {
    const prev = out[value.charId] || {};
    const skills = new Map((prev.skills || []).map(s => [s.index, s]));
    for (const [index, sk] of (value.skills || []).entries()) {
      const i = Number.isInteger(sk.index) ? sk.index : index;
      if (sk.skillId) skills.set(i, { index: i, skillId: sk.skillId, iconId: sk.iconId || sk.skillId });
    }
    out[value.charId] = { ...prev, name: value.name, subProfessionId: value.subProfessionId || prev.subProfessionId,
      nationId: value.nationId || prev.nationId, skills: [...skills.values()].sort((a, b) => a.index - b.index) };
  }
  for (const child of Object.values(value)) if (child && typeof child === 'object') collectOperatorRecords(child, out);
  return out;
}

export async function workshopOperators(root) {
  const operators = {};
  const folders = await readdir(join(root, 'workshop'), { withFileTypes: true }).catch(() => []);
  for (const dir of folders.filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    for (const file of ['chess.json', 'backups.json']) {
      let text;
      try { text = await readFile(join(root, 'workshop', dir.name, file), 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      collectOperatorRecords(JSON.parse(text), operators);
    }
  }
  return operators;
}
