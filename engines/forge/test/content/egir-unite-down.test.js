import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, checkInvariants } from '../helpers/battleHarness.js';
import { FORCED_EXIT } from '../../server/sim/constants.js';
const bonds = count => ({ egirShip: { count, active: count >= 3, tier: count >= 5 ? 2 : 1, layers: 0 } });
const rec = (id, member = true) => chessRec({ id, profession: 'WARRIOR', bonds: member ? ['egirShip'] : [], stats: { atk: 0, maxHp: 1000, cost: 20, respawnTime: 60 }, skill: { spCost: 30, initSp: 5, duration: 10 } });
function field({ down = [0], count = 5, kind = 'unite', players = null, bandId = null, enabled = true } = {}) {
  const chess = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`g${i}`, rec(`g${i}`, i < 5)]));
  const units = Array.from({ length: 6 }, (_, i) => ({ chessId: `g${i}`, dir: 'RIGHT', row: 12 - i % 4, col: 3 + 2 * Math.floor(i / 4), carryState: down.includes(i) ? { down: true } : { hpPct: .5, sp: 20 } }));
  return makeBattle({ kind, defs: { chess }, units, players, bandId, bonds: bonds(count), autoFinish: false, timeLimit: 120, flags: { operatorFixesEnabled: enabled, dpInit: 0, dpPerSec: 0 }, hooks: ['deploy', 'death', 'kill', 'battleStart'] });
}
test('Egir five: a carried-down member revives immediately before battleStart at zero DP, full HP and initial SP', () => {
  const h = field(); h.b.start(); const u = h.unit('g0');
  assert.ok(u.alive && u.deployed); assert.equal(u.hp, u.s.maxHp); assert.equal(u.skill.sp, 5);
  assert.equal(h.b.isDown(u), false); assert.equal(h.b.players[0].dp, 0);
  assert.ok(h.hooksOf('death').some(c => c.unit === u && c.reason === FORCED_EXIT));
  assert.equal(h.hooksOf('kill').length, 0, 'no ordinary knockout effects');
  assert.equal(h.hooksOf('deploy').filter(c => c.unit === u && !c.initial).length, 1);
  assert.equal(h.unit('g1').hp, h.unit('g1').s.maxHp * .5, 'standing member keeps carried HP');
  assert.equal(h.unit('g1').skill.sp, 20);
  h.b.kill(u); assert.ok(!u.alive, 'same member cannot spend a second Egir revive'); checkInvariants(h.b);
});
test('carried-down members consume the same three-charge budget used by later combat deaths', () => {
  const h = field({ down: [0, 1] }); h.b.start();
  assert.ok(h.unit('g0').alive && h.unit('g1').alive);
  h.b.kill(h.unit('g2')); assert.ok(h.unit('g2').alive, 'one charge remains');
  h.b.kill(h.unit('g3')); assert.ok(!h.unit('g3').alive, 'three charges used'); checkInvariants(h.b);
});
test('four carried-down members: only the first three revive; others and nonmembers wait normally', () => {
  const h = field({ down: [0, 1, 2, 3, 5] }); h.b.start();
  const members = [0, 1, 2, 3].map(i => h.unit(`g${i}`));
  assert.equal(members.filter(u => u.alive).length, 3);
  assert.equal(members.filter(u => h.b.isDown(u)).length, 1);
  assert.ok(h.b.isDown(h.unit('g5')), 'nonmember stays down'); checkInvariants(h.b);
});
test('no five-member tier, non-unite fields and later voluntary retreats never use the carried-down revive exception', () => {
  for (const opts of [{ count: 3 }, { kind: 'normal' }, { kind: 'boss' }]) {
    const h = field(opts); h.b.start(); assert.ok(h.b.isDown(h.unit('g0'))); checkInvariants(h.b);
  }
  const h = field({ down: [] }); h.b.start(); const u = h.unit('g0');
  h.b.retreat(u, { reason: 'retreat' }); assert.ok(h.b.isDown(u));
  h.b.redeploy(u, { free: true }); h.b.kill(u); assert.ok(u.alive, 'voluntary retreat did not consume charge');
});
test('each helper uses only its own Egir tier and charges on a shared unite field', () => {
  const units = pid => [0, 1, 2, 3].map(i => ({ uid: `${pid}-${i}`, chessId: `g${i}`, dir: 'RIGHT', row: 12 - i, col: 3, carryState: { down: true } }));
  const h = field({ players: [{ playerId: 'p1', seat: 0, colOffset: 0, bonds: bonds(5), units: units('p1') }, { playerId: 'p2', seat: 1, colOffset: 10, bonds: bonds(5), units: units('p2') }] });
  h.b.start();
  for (const p of h.b.players) {
    assert.equal(p.units.filter(u => u.alive).length, 3, p.playerId);
    assert.equal(p.units.filter(u => h.b.isDown(u)).length, 1, p.playerId);
  }
  checkInvariants(h.b);
});

test('埃芒加德: entering unite already down uses a band charge; remaining charges save later fatal damage', () => {
  const h = field({ down: [0], count: 3, bandId: 'band_ermengard' }); h.b.start();
  const u = h.unit('g0'); assert.ok(u.alive); assert.equal(u.hp, u.s.maxHp); assert.equal(u.skill.sp, 5);
  assert.equal(h.hooksOf('kill').length, 0);
  const hit = () => h.b.dealDamage(null, u, { type: 'true', amount: 1e9 });
  hit(); assert.ok(u.alive); hit(); assert.ok(u.alive); hit(); assert.ok(!u.alive, 'three band charges total');
  checkInvariants(h.b);
});
test('Egir has priority on unite entry: three Egir revives leave all three 埃芒加德 charges untouched', () => {
  const h = field({ down: [0, 1, 2], bandId: 'band_ermengard' }); h.b.start();
  for (const i of [0, 1, 2]) assert.ok(h.unit(`g${i}`).alive);
  const u = h.unit('g5');
  for (let i = 0; i < 3; i++) { h.b.dealDamage(null, u, { type: 'true', amount: 1e9 }); assert.ok(u.alive, 'band charge remains'); }
  h.b.dealDamage(null, u, { type: 'true', amount: 1e9 }); assert.ok(!u.alive); checkInvariants(h.b);
});
test('埃芒加德 covers excess Egir members and nonmembers; ordinary retreats remain excluded', () => {
  const h = field({ down: [0, 1, 2, 3, 5], bandId: 'band_ermengard' }); h.b.start();
  for (const i of [0, 1, 2, 3, 5]) assert.ok(h.unit(`g${i}`).alive);
  const u = h.unit('g4'); h.b.retreat(u, { reason: 'retreat' }); assert.ok(h.b.isDown(u));
  h.b.redeploy(u, { free: true });
  h.b.dealDamage(null, u, { type: 'true', amount: 1e9 }); assert.ok(u.alive, 'last band charge');
  h.b.dealDamage(null, u, { type: 'true', amount: 1e9 }); assert.ok(!u.alive, 'all band charges used'); checkInvariants(h.b);
});
test('埃芒加德 belongs to its own helper: it never consumes charges for the teammate', () => {
  const units = pid => [0, 1, 2, 3].map(i => ({ uid: `${pid}-${i}`, chessId: `g${i}`, dir: 'RIGHT', row: 12 - i, col: 3, carryState: { down: true } }));
  const h = field({ players: [{ playerId: 'p1', seat: 0, colOffset: 0, bandId: 'band_ermengard', bonds: bonds(3), units: units('p1') }, { playerId: 'p2', seat: 1, colOffset: 10, bonds: bonds(3), units: units('p2') }] });
  h.b.start();
  assert.equal(h.b.players[0].units.filter(u => u.alive).length, 3);
  assert.equal(h.b.players[1].units.filter(u => u.alive).length, 0);
  checkInvariants(h.b);
});

test('operator-source revive fix disabled preserves original carried-down exit',()=>{
 const h=field({enabled:false});h.b.start();assert.ok(h.b.isDown(h.unit('g0')));checkInvariants(h.b);
});
