import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, makeMatch } from './harness.js';
const NORMALS = Object.values(DATA.chess).filter(c => c.charId && !c.isDiy && !c.isGolden && c.goldenId);
const GAIN = NORMALS.filter(c => (DATA.chess[c.goldenId].garrisonIds || []).some(g => DATA.garrisons[g]?.eventType === 'SERVER_GAIN'));
function setup() {
  const h = makeMatch({ mode: 'solo', seed: 70, fake: true, data: DATA, rhineEnabled: true }).start(); h.toPrep(1);
  const ps = h.ps('p_0');
  for (const p of ps.allChess()) ps.returnCopies(p);
  ps.board.clear(); ps.hand.fill(null); ps.temp.fill(null); ps.offers.length = 0;
  ps.bandId = null; ps.funds = 100; ps.pendingFunds = 0; ps.layers = {}; ps.shop.freeRefreshes = 0;
  for (const b of h.m.gd.bondIds) ps.bondCountBonus[b] = 20;
  ps.layers.egirShip = 7; ps.recompute();
  return { h, m: h.m, ps };
}
const state = ps => {
  const pieces = [...ps.board.values(), ...ps.hand.filter(Boolean), ...ps.temp.filter(Boolean)];
  const owned = {};
  for (const p of pieces) if (p.kind === 'chess' || p.kind === 'item') owned[p.id] = (owned[p.id] || 0) + 1;
  return { layers: { ...ps.layers }, pending: ps.pendingFunds, free: ps.shop.freeRefreshes, owned };
};
test('all installed operator pairs: normal merging acquires one fresh elite and dispatches its onGain exactly once', () => {
  assert.ok(NORMALS.length >= 129);
  for (const c of NORMALS) {
    const { h, m, ps } = setup();
    try {
      const old = [];
      for (let n = 1; n < m.gd.mergeCount(c.chessId); n++) {
        const p = ps.acquireChess(c.chessId, { silent: true }); assert.ok(p, c.name);
        ps.bumpPieceRoundCount(p, 'audit:old-trait', 9); p.meta.audit = 'old'; old.push(p.uid);
      }
      const gain = [], dispatch = m.dispatch.bind(m);
      m.dispatch = (player, hook, ev) => { if (hook === 'onGain') gain.push({ uid: ev.piece.uid, id: ev.piece.id }); return dispatch(player, hook, ev); };
      const elite = ps.acquireChess(c.chessId);
      assert.equal(elite.id, c.goldenId, c.name);
      assert.ok(!old.includes(elite.uid)); assert.ok(old.every(uid => !ps.find(uid)));
      assert.equal(ps.pieceRoundCount(elite, 'audit:old-trait'), 0, `${c.name}: fresh round counter`);
      assert.equal(elite.meta.audit, undefined);
      assert.equal(gain.filter(e => e.uid === elite.uid && e.id === c.goldenId).length, 1, `${c.name}: elite gain once`);
      assert.equal(ps.stats.merges, 1);
      assert.deepEqual(h.logs.error, [], c.name);
    } finally { m.dispose(); }
  }
});
test('all 29 operators with gain traits: merged elite gives the same rewards as acquiring that elite directly', () => {
  assert.equal(GAIN.length, 29);
  for (const c of GAIN) {
    const a = setup(), b = setup();
    try {
      a.ps.acquireChess(c.goldenId);
      for (let n = 1; n < b.m.gd.mergeCount(c.chessId); n++) b.ps.acquireChess(c.chessId, { silent: true });
      b.ps.acquireChess(c.chessId);
      assert.deepEqual(state(b.ps), state(a.ps), c.name);
      assert.deepEqual(a.h.logs.error, []); assert.deepEqual(b.h.logs.error, []);
    } finally { a.m.dispose(); b.m.dispose(); }
  }
});
test('博士投影/升华 direct promotion remains separate: no new onGain or per-piece counter reset', () => {
  const { m, ps } = setup();
  try {
    const p = ps.acquireChess('chess_char_1_07_a'); // 普罗旺斯: gain grants a free refresh
    const uid = p.uid, free = ps.shop.freeRefreshes;
    ps.bumpPieceRoundCount(p, 'audit:old-trait', 9);
    assert.equal(ps.promote(p), true);
    assert.equal(p.uid, uid); assert.equal(ps.pieceRoundCount(p, 'audit:old-trait'), 9);
    assert.equal(ps.shop.freeRefreshes, free, 'no elite gain reward from direct promotion');
  } finally { m.dispose(); }
});
