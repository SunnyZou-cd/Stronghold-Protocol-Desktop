import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkshop } from '../../server/workshop.js';
import { loadData, DATA_DIR } from '../../server/data.js';
import { loadMetaModules, buildRoomRegistry } from '../../server/match/metaPack.js';
import { createRegistry } from '../../server/match/effectsMeta.js';
import { makeMatch } from './harness.js';

const quiet = { info() {}, warn() {}, error() {} };
const loaded = loadWorkshop(undefined, { log: quiet });
const modules = await loadMetaModules(loaded, { log: quiet });
assert.deepEqual(modules.errors, []);
const built = buildRoomRegistry({ packs: modules.modules, base: createRegistry({ content: false }), log: quiet });
assert.deepEqual(built.errors, []);
const data = loadData(DATA_DIR, { log: quiet });
const ids = ['band_ws_dong_invitation', 'band_ws_rhodes_rotation', 'band_ws_rhine_milestones', 'band_ws_kazdel_souls'];
function setup(band, seed = 317) {
  const h = makeMatch({ mode: 'solo', seed, fake: true, data, registry: built.registry }).start();
  h.toPrep(1);
  const ps = h.ps('p_0');
  for (const p of [...ps.board.values(), ...ps.hand.filter(Boolean), ...ps.temp.filter(Boolean)]) if (p.kind === 'chess') ps.returnCopies(p);
  ps.board.clear(); ps.hand.fill(null); ps.temp.fill(null); ps.offers.length = 0;
  ps.funds = 500; ps.layers = {}; ps.counters = {}; ps.bandId = band;
  ps.shop.level = 1; ps.shop.freeRefreshes = 0; ps.recompute();
  return { h, m: h.m, ps };
}
const normal = (ps, bond) => Object.values(data.chess).find(c => c.visible && !c.isGolden && !c.isDiy && c.bonds?.includes(bond) && c.tier <= ps.shop.level)?.chessId;
const slot = id => ({ kind: 'chess', id, basePrice: 4, frozen: false, sold: false });

test('six core packs have one strategy each; four local additions are labeled fan work and independently scoped', () => {
  assert.equal(Object.keys(data.bands).length, 46);
  for (const id of ids) {
    assert.ok(data.bands[id].desc.includes('同人原创策略'));
    assert.equal(data.bands[id].bondIds.length, 1);
    assert.ok(built.registry.has(`band:${id}`));
  }
  for (const [pack, id] of [['dongShip', ids[0]], ['fanpack-rhodes', ids[1]], ['lele-rhine', ids[2]], ['lele-kazdel', ids[3]]]) {
    const disabled = loadData(DATA_DIR, { log: quiet, excludePacks: new Set([pack]) });
    assert.equal(disabled.bands[id], undefined, `${pack} off removes its draft option`);
    assert.equal(Object.keys(disabled.bands).length, 45);
    const selected = buildRoomRegistry({ packs: modules.modules.filter(p => p.id !== pack), base: createRegistry({ content: false }), log: quiet });
    assert.deepEqual(selected.errors, []);
    assert.equal(selected.registry.has(`band:${id}`), false, 'disabled pack does not register a strategy handler');
  }
  assert.equal(Object.keys(loadData(DATA_DIR, { log: quiet, workshopDir: null }).bands).length, 40);
});

test('Dong: only manual refreshes count; paid/free both count, two per round cap, progress carries, deterministic draws', () => {
  const run = () => {
    const { h, m, ps } = setup(ids[0]);
    ps.shop.level = 6;
    const grants = [], acquire = ps.acquireChess.bind(ps);
    ps.acquireChess = (id, opts) => { const p = acquire(id, opts); if (opts?.source === 'band' && p) grants.push(id); return p; };
    ps.rollShop(); ps.rollShop({ keepFrozen: true });
    assert.equal(ps.counters['ws:dong:invitation:refreshes'] ?? 0, 0);
    for (let n = 0; n < 5; n++) assert.deepEqual(ps.refresh(), { ok: true });
    assert.equal(grants.length, 0);
    ps.shop.freeRefreshes = 1;
    const before = ps.funds;
    assert.deepEqual(ps.refresh(), { ok: true });
    assert.equal(ps.funds, before);
    assert.equal(grants.length, 1);
    for (let n = 0; n < 12; n++) assert.deepEqual(ps.refresh(), { ok: true });
    assert.equal(grants.length, 2);
    m.round = 2; ps.round.refreshes = 0;
    for (let n = 0; n < 6; n++) assert.deepEqual(ps.refresh(), { ok: true });
    assert.equal(grants.length, 3);
    assert.ok(grants.every(id => ps.gd.chess(id).bonds.includes('dongShip') && ps.gd.chess(id).tier <= 6));
    assert.equal(m.dispatcher.errors, 0);
    h.invariants();
    return { grants, funds: ps.funds, counters: ps.counters };
  };
  assert.deepEqual(run(), run());
});

test('Rhodes: pure previews, failed buy keeps allowance, first successful buy pays one, sale does not refund discount', () => {
  const { h, m, ps } = setup(ids[1]);
  ps.shop.level = 6;
  const id = 'chess_char_9_11_a'; // Frostleaf: no gain/sale price modifier obscuring the strategy charge.
  assert.ok(ps.gd.chess(id).bonds.includes('rhodesShip'));
  ps.shop.slots = [slot(id)];
  assert.equal(ps.priceOf(ps.shop.slots[0]), 1);
  assert.equal(ps.priceOf(ps.shop.slots[0]), 1);
  ps.funds = 0;
  assert.ok(ps.buy(0).error);
  assert.equal(ps.priceOf(ps.shop.slots[0]), 1);
  ps.acquireChess(id, { source: 'reward' });
  assert.equal(ps.priceOf(ps.shop.slots[0]), 1, 'free grant does not consume first purchase');
  ps.funds = 20;
  assert.deepEqual(ps.buy(0), { ok: true }); assert.equal(ps.funds, 19);
  ps.shop.slots = [slot(id)];
  assert.equal(ps.priceOf(ps.shop.slots[0]), 4);
  const piece = ps.hand.find(p => p?.kind === 'chess');
  const refund = ps.gd.sellPrice(piece.id);
  assert.deepEqual(ps.sell(piece.uid), { ok: true });
  assert.equal(ps.funds, 19 + refund);
  assert.equal(ps.priceOf(ps.shop.slots[0]), 4);
  m.round = 2;
  assert.equal(ps.priceOf(ps.shop.slots[0]), 1);
  ps.shop.slots[0].basePrice = 0;
  assert.equal(ps.priceOf(ps.shop.slots[0]), 0, 'does not increase an existing zero price');
  ps.rollShop();
  assert.equal(m.dispatcher.errors, 0); h.invariants();
});

test('Rhine: actual upgrades grant 4/8/12 once per milestone, preserve layers while inactive and clamp to 999', () => {
  const { h, m, ps } = setup(ids[2]);
  assert.equal(ps.bonds.rhineShip?.active ?? false, false);
  const expected = [4, 4, 12, 12, 24];
  for (let i = 0; i < 5; i++) {
    ps.shop.upgradePrice = 0;
    assert.deepEqual(ps.levelUp(), { ok: true });
    assert.equal(ps.layers.rhineShip, expected[i]);
  }
  m.dispatch(ps, 'onLevelUp', { level: 6, price: 0 });
  assert.equal(ps.layers.rhineShip, 24);
  assert.ok(ps.researchView().devices.every(d => d.points === 0), 'not device research points');
  ps.layers.rhineShip = 997; delete ps.counters['ws:rhine:milestone:2'];
  m.dispatch(ps, 'onLevelUp', { level: 2, price: 0 });
  assert.equal(ps.layers.rhineShip, 999);
  assert.equal(m.dispatcher.errors, 0); h.invariants();
});

test('Kazdel: real three-copy merges trigger once per round; direct elite grants and other bonds do not', () => {
  const { h, m, ps } = setup(ids[3]);
  ps.shop.level = 6;
  const id = normal(ps, 'kazdelShip'); assert.ok(id);
  const elite = ps.gd.goldenIdOf(id);
  ps.acquireChess(elite, { source: 'reward' });
  assert.equal(ps.layers.kazdelShip ?? 0, 0);
  const promoted = ps.acquireChess(id);
  assert.equal(ps.promote(promoted), true);
  assert.equal(ps.layers.kazdelShip ?? 0, 0, 'equipment-style promotion is not a merge');
  for (let n = 0; n < 3; n++) ps.acquireChess(id);
  assert.equal(ps.layers.kazdelShip, 6);
  for (let n = 0; n < 3; n++) ps.acquireChess(id);
  assert.equal(ps.layers.kazdelShip, 6);
  m.round = 2;
  const other = Object.values(data.chess).find(c => c.visible && !c.isGolden && !c.isDiy && !c.bonds?.includes('kazdelShip'));
  m.dispatch(ps, 'onMerge', { kind: 'chess', piece: { id: other.goldenId } });
  m.dispatch(ps, 'onMerge', { kind: 'item', piece: { id: elite } });
  assert.equal(ps.layers.kazdelShip, 6);
  for (let n = 0; n < 3; n++) ps.acquireChess(id);
  assert.equal(ps.layers.kazdelShip, 12);
  assert.equal(m.dispatcher.errors, 0); h.invariants();
});
