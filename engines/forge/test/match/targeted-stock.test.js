import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SharedPool, SharedItemPool } from '../../server/match/pool.js';
import { createRng } from '../../server/sim/rng.js';

function fixture() {
  const gd = { visibleChess: [], shopItemsByTier: { 1: ['target', 'other'] },
    item: id => ({ giveBondId: id === 'target' ? 'bond' : null }),
    itemPoolCopies: () => 2, baseIdOf: id => id, isGolden: () => false };
  const player = { hand: [], temp: [], board: new Map() };
  return { player, pool: new SharedPool(gd), stock: new SharedItemPool(gd, () => [player]) };
}
const opts = { bondBoost: new Map([['bond', 2.6]]), onTierMiss: 'random' };
test('targeted equipment keeps 2.6 weighting while respecting shared ownership and release', () => {
  const { player, pool, stock } = fixture(), rng = createRng(20261011);
  let targets = 0;
  for (let i = 0; i < 10000; i++) targets += pool.rollItem(rng, 1, stock, opts) === 'target';
  assert.ok(Math.abs(targets / 10000 - 2.6 / 3.6) < 0.02);
  player.hand.push({ kind: 'item', id: 'target' }, { kind: 'item', id: 'target' });
  for (let i = 0; i < 100; i++) assert.equal(pool.rollItem(rng, 1, stock, opts), 'other');
  player.hand.pop();
  assert.equal(pool.rollItem(() => 0, 1, stock, opts), 'target');
  player.hand.push({ kind: 'item', id: 'target' }, { kind: 'item', id: 'other' }, { kind: 'item', id: 'other' });
  assert.equal(pool.rollItem(rng, 1, stock, opts), null, 'all equipment exhausted');
});
test('disabled targeted selection preserves the uniform item draw with shared stock', () => {
  const { pool, stock } = fixture(), rng = createRng(123);
  let targets = 0;
  for (let i = 0; i < 10000; i++) targets += pool.rollItem(rng, 1, stock) === 'target';
  assert.ok(Math.abs(targets / 10000 - 0.5) < 0.02);
});
