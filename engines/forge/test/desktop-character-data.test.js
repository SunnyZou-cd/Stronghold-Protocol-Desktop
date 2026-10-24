import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadData } from '../server/data.js';
import { loadWorkshop } from '../server/workshop.js';
import { applyWorkshop } from '../shared/workshop.js';
import { desktopBondMembers } from '../shared/desktopBondMembers.js';
import { portraitUrlOf, avatarUrlOf } from '../public/js/ui/portraitChain.js';
const log = { warn() {}, info() {}, error: assert.fail };
const official = loadData(undefined, { workshopDir: null, log });
const packs = loadWorkshop(undefined, { log }).packs;
assert.equal(packs.length, 6, 'all six bundled packs must load');

for (let mask = 0; mask < 64; mask++) test(`desktop member catalogue agrees with actual characters for pack subset ${mask}`, () => {
  const selected = packs.filter((_, i) => mask & (1 << i));
  const { data, report } = applyWorkshop(official, selected);
  assert.deepEqual(report.errors, []);
  for (const native of ['rhine', 'kazdel']) {
    const enabled = selected.some(p => p.id === `lele-${native}`);
    assert.equal(!!data.bonds[native + 'Ship'], enabled, native);
    assert.equal(!!data.chess[native === 'rhine' ? 'chess_rhine_mayer_a' : 'chess_kazdel_odd_a'], enabled);
    assert.equal(!!data.items[native === 'rhine' ? 'chess_item_rhine_terminal_a' : 'chess_item_kazdel_sigil_a'], enabled);
  }
  for (const [id, bond] of Object.entries(data.bonds)) {
    for (const field of ['members', 'visibleMembers']) {
      const expected = Object.values(data.chess).filter(c => !c.isGolden && !c.desktopCanonicalId && c.bonds?.includes(id)
        && (field === 'members' || (c.visible !== false && !c.isHidden))).map(c => c.chessId);
      assert.deepEqual(new Set(bond[field]), new Set(expected), `${id}.${field}`);
      assert.equal(bond[field].length, new Set(bond[field]).size);
    }
  }
});

test('desktop normal and elite character art resolves through the production portrait chain', () => {
  const { data } = applyWorkshop(official, packs);
  for (const c of Object.values(data.chess).filter(c => c.visible && !c.isDiy && c.charId)) {
    assert.ok(portraitUrlOf(data.assets, c), `${c.name} portrait`);
    assert.ok(avatarUrlOf(data.assets, c), `${c.name} avatar`);
    if (c.skill) assert.ok(data.assets.skills[c.skill.iconId || c.skill.skillId], `${c.name} skill icon`);
  }
  const sources = JSON.parse(fs.readFileSync(new URL('../../../diagnostics/character-art-sources.json', import.meta.url)));
  assert.equal(sources.length, 16);
  const kafka = data.chess.chess_ws_col_kafka_a, amiya = data.chess.chess_char_9_14_a;
  assert.notEqual(portraitUrlOf(data.assets, kafka), portraitUrlOf(data.assets, amiya));
  assert.equal(kafka.charId, 'char_214_kafka'); assert.equal(amiya.charId, 'char_002_amiya');
});

test('catalogue repair does not mutate inputs and is disabled outside this desktop bundle', () => {
  const input = { chess: {}, bonds: { b: { members: ['missing'] } } };
  assert.equal(desktopBondMembers(input), input);
  const configured = { ...input, config: { economy: { desktopAlliances: [] } } };
  const repaired = desktopBondMembers(configured);
  assert.deepEqual(input.bonds.b.members, ['missing']);
  assert.deepEqual(repaired.bonds.b.members, []);
});
