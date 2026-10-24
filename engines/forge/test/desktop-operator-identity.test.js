import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../server/data.js';
import { loadWorkshop } from '../server/workshop.js';
import { applyWorkshop } from '../shared/workshop.js';
import { desktopOperatorIdentity, desktopOperatorKey, desktopDiyIdentity } from '../shared/desktopOperatorIdentity.js';
import { GameData } from '../server/match/gamedata.js';
import { SharedPool } from '../server/match/pool.js';
import { DataSource } from '../server/sim/simdata.js';
import { createRoomAssets } from '../server/roomAssets.js';
import { buildWorkshopDataFiles } from '../server/http/workshop.js';
import { diyRecordOf } from '../shared/diy.js';

const log = { info() {}, warn() {}, error: assert.fail };
const base = loadData(undefined, { workshopDir: null, log });
const packs = loadWorkshop(undefined, { log }).packs;
assert.equal(packs.length, 6);
const active = data => Object.values(data.chess).filter(c => c.visible && !c.isGolden && !c.isDiy && !c.isHidden);
const named = (data, name) => active(data).filter(c => c.name === name);

for (let mask = 0; mask < 64; mask++) test(`selected identities are unique and isolated for all six-pack subset ${mask}`, () => {
  const selected = packs.filter((_, i) => mask & (1 << i));
  const enabled = id => selected.some(p => p.id === id);
  const { data, report } = applyWorkshop(base, selected);
  assert.deepEqual(report.errors, []);
  const gd = new GameData(data, 'mode_multi_normal');
  const pool = new SharedPool(gd);
  const source = new DataSource(data);
  assert.equal(new Set(active(data).map(desktopOperatorKey)).size, active(data).length);
  for (const c of active(data)) {
    assert.ok(pool.has(c.chessId));
    assert.deepEqual(source.rawChess(c.chessId).bonds, gd.chess(c.chessId).bonds);
    for (const id of c.bonds) assert.ok(data.bonds[id], id);
    for (const id of c.garrisonIds) assert.ok(data.garrisons[id], id);
    assert.equal(new Set(c.garrisonIds).size, c.garrisonIds.length);
    const elite = data.chess[c.goldenId];
    if (elite) assert.deepEqual(elite.bonds, c.bonds, c.name);
  }
  const logos = named(data, '逻各斯');
  assert.equal(logos.length, Number(enabled('lele-kazdel') || enabled('fanpack-rhodes')));
  for (const c of logos) {
    assert.equal(c.bonds.includes('kazdelShip'), enabled('lele-kazdel'));
    assert.equal(c.bonds.includes('rhodesShip'), enabled('fanpack-rhodes'));
    for (const elite of [false, true]) {
      const r = elite ? data.chess[c.goldenId] : c;
      assert.equal(r.garrisonIds.some(id => id.startsWith('garrison_kazdel_logos')), enabled('lele-kazdel'));
      assert.equal(r.garrisonIds.some(id => id.startsWith('garrison_c_logos')), enabled('fanpack-rhodes'));
      const diy = desktopDiyIdentity({ ...r, isDiy: true, bonds: [], garrisonIds: [] }, source);
      assert.deepEqual(diy.garrisonIds, r.garrisonIds);
      assert.deepEqual(diy.bonds, r.bonds);
    }
  }
  const saria = named(data, '塞雷娅');
  assert.equal(saria.length, 1);
  assert.ok(saria[0].bonds.includes('soloShip'));
  assert.equal(saria[0].bonds.includes('rhineShip'), enabled('lele-rhine'));
  for (const r of [saria[0], data.chess[saria[0].goldenId]]) {
    assert.ok(r.garrisonIds.some(id => id.startsWith('garrison_99_')));
    assert.equal(r.garrisonIds.some(id => id.startsWith('garrison_rhine_saria')), enabled('lele-rhine'));
  }
  assert.equal(named(data, '谬因').length, Number(enabled('lele-rhine') || enabled('columbia')));
  for (const c of Object.values(data.chess).filter(c => c.desktopCanonicalId)) {
    assert.equal(pool.has(c.chessId), false);
    const canonical = data.chess[c.desktopCanonicalId];
    assert.deepEqual(c.bonds, canonical.bonds);
    assert.deepEqual(c.garrisonIds, canonical.garrisonIds);
    assert.ok(!Object.values(data.bonds).some(b => b.members.includes(c.chessId)));
  }
});

test('room snapshots and HTTP bodies use the same identity data; switching packs leaves no grants', () => {
  const processData = applyWorkshop(base, packs).data;
  const rooms = createRoomAssets({ official: base, processData, packs, kits: {}, kitOwners: new Map(), modules: [] });
  const all = rooms.forRoom({ digest: 'all', packs });
  assert.equal(all.data, processData);
  const onlyRhodes = rooms.forRoom({ digest: 'rhodes', packs: [{ id: 'fanpack-rhodes' }] });
  const none = rooms.forRoom({ digest: 'none', packs: [] });
  assert.deepEqual(named(onlyRhodes.data, '逻各斯')[0].bonds, ['rhodesShip', 'visiShip']);
  assert.equal(named(none.data, '逻各斯').length, 0);
  assert.equal(named(none.data, '塞雷娅')[0].bonds.includes('rhineShip'), false);
  assert.equal(rooms.byDigest('rhodes').data, onlyRhodes.data);
  const bodies = buildWorkshopDataFiles(processData, { packs });
  for (const file of ['chess', 'bonds', 'backups', 'support']) {
    assert.deepEqual(JSON.parse(bodies.get(file)), processData[file]);
  }
});

test('identity matching guards homonyms and templates, keeps inputs intact, and leaves vanilla DIY unchanged', () => {
  assert.notEqual(desktopOperatorKey({ name: '阿米娅', charId: 'char_002_amiya', tmplId: 'caster' }),
    desktopOperatorKey({ name: '阿米娅', charId: 'char_002_amiya', tmplId: 'guard' }));
  assert.notEqual(desktopOperatorKey({ name: '同名', charId: 'a' }), desktopOperatorKey({ name: '同名', charId: 'b' }));
  const plain = { chess: {} };
  assert.equal(desktopOperatorIdentity(plain), plain);
  const before = JSON.stringify(base.chess);
  applyWorkshop(base, packs);
  assert.equal(JSON.stringify(base.chess), before);
  const data = applyWorkshop(base, []).data;
  const saria = named(data, '塞雷娅')[0];
  const diy = { ...saria, isDiy: true, bonds: [], garrisonIds: [] };
  assert.equal(desktopDiyIdentity(diy, data), diy);
  assert.deepEqual(applyWorkshop(base, packs).data.chess, applyWorkshop(base, [...packs].reverse()).data.chess);
});

test('real DIY composition and DataSource getDiy preserve the chosen skill and rank while adding enabled identity', () => {
  const data = applyWorkshop(base, packs.filter(p => p.id === 'lele-kazdel')).data;
  const source = new DataSource(data);
  const pick = { charId: 'char_4133_logos', skillIndex: 0, uniEquipId: null };
  for (const suffix of ['a', 'b']) {
    const id = `chess_char_6_diy1_${suffix}`;
    const record = diyRecordOf(data.chess[id], pick, data);
    assert.ok(record);
    assert.equal(record.skill.index, 0);
    assert.equal(record.skill.skillId, 'skchr_logos_1');
    assert.deepEqual(record.status, data.chess[id].status);
    assert.deepEqual(record.garrisonIds, [`garrison_kazdel_logos_${suffix}`]);
    const def = source.getDiy(id, pick);
    assert.deepEqual(def.raw.garrisonIds, record.garrisonIds);
    assert.deepEqual(def.bonds, record.bonds);
  }
});
