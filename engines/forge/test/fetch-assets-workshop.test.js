import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { collectOperatorRecords, workshopOperators } from '../tools/assets/workshop-operators.mjs';

test('asset roster collects ordinary and elite workshop presets without losing alternate skills', () => {
  const out = collectOperatorRecords({ ordinary: { charId: 'char_193_frostl', name: '霜叶', subProfessionId: 'lord', skills: [{ index: 0, skillId: 'skchr_frostl_1' }] },
    elite: { charId: 'char_193_frostl', name: '霜叶', skills: [{ index: 1, skillId: 'skchr_frostl_2' }] },
    invalid: { charId: '../outside', name: 'invalid' } });
  assert.deepEqual(Object.keys(out), ['char_193_frostl']);
  assert.equal(out.char_193_frostl.subProfessionId, 'lord');
  assert.deepEqual(out.char_193_frostl.skills.map(s => s.skillId), ['skchr_frostl_1', 'skchr_frostl_2']);
});

test('shipped workshop-only operators are included in the default asset download plan', async () => {
  const roster = await workshopOperators(fileURLToPath(new URL('..', import.meta.url)));
  for (const id of ['char_193_frostl', 'char_260_durnar', 'char_002_amiya', 'char_214_kafka', 'char_4184_dolris']) {
    assert.ok(roster[id]?.name, id);
  }
});
