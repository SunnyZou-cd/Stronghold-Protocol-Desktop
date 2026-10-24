import { loadData } from '../../server/data.js';
import { setSimData } from '../../server/sim/simdata.js';
import { fileURLToPath } from 'node:url';
const EXTRA_DATA=loadData(fileURLToPath(new URL('../../data/rhine-extra',import.meta.url)));
setSimData(EXTRA_DATA);
import { setGameData } from '../../server/sim/content/support/index.js';
setGameData(EXTRA_DATA);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, chessRec, checkInvariants } from '../helpers/battleHarness.js';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../../data/rhine-extra/chess.json', import.meta.url)));
const id = 'chess_char_5_makoto_a';
const active = { active: true, count: 3, tier: 1, layers: 0 };
function setup(index = 2, gold = false, bonds = {}) {
  const cid = gold ? id.replace(/_a$/, '_b') : id;
  const c = structuredClone(data[cid]);
  c.skill = c.skills[index];
  const h = makeBattle({ units: [{ chessId: cid, row: 10, col: 5 }, { chessId: 'friend', row: 10, col: 6 }],
    defs: { chess: { [cid]: c, friend: chessRec({ id: 'friend', skill: null, stats: { maxHp: 10000, atk: 0, blockCnt: 0 } }) },
      enemies: { dummy: enemyRec({ key: 'dummy', hp: 1e7, atk: 0, speed: 0, def: 1000, res: 0 }) } },
    enemies: [{ key: 'dummy', pos: [10, 6] }], bonds, captureNoisy: true, timeLimit: 100, autoFinish: false });
  h.step(); const u = h.unit(cid);
  u.skill.rule = 'NEVER';
  return { h, u, e: h.enemies()[0], friend: h.unit('friend') };
}
const gains = h => h.result().perPlayer.p1.layerGains;
const clean = h => { assert.deepEqual(h.b.errors, []); checkInvariants(h.b); };
for (const gold of [false, true]) test(`Makoto ${gold ? 'elite +6' : 'normal +3'}: swaps/KO active bonds, no persona double count`, () => {
  const {h,u} = setup(2, gold, { lateranoShip: {...active}, indomShip: {...active} });
  const n = gold ? 6 : 3;
  h.b.emit('dollSwitch', { unit: u, done: false }); h.run(1.1);
  assert.deepEqual(gains(h), { lateranoShip:n, indomShip:n });
  h.b.dealDamage(null, u, { amount: 1e7, type: 'true' }); h.run(1.1);
  assert.equal(u.s.blockCnt, 2);
  assert.deepEqual(gains(h), { lateranoShip:n, indomShip:n });
  h.run(20);
  assert.equal(u.trait.doll,false);
  assert.deepEqual(gains(h), { lateranoShip:2*n, indomShip:2*n });
  h.b.kill(u); h.step();
  assert.deepEqual(gains(h), { lateranoShip:3*n, indomShip:3*n });
  clean(h);
});
test('Makoto: inactive bonds never gain layers, fatal body enters boosted substitute with full HP', () => {
  const {h,u} = setup(0,false,{ lateranoShip: {...active}, indomShip: {...active, active:false,count:0,tier:0} });
  h.b.dealDamage(null,u,{amount:1e7,type:'true'}); h.run(1.1);
  assert.ok(u.trait.doll && u.alive);
  assert.equal(u.s.maxHp,u.base.maxHp*1.35);
  assert.equal(u.hp,u.s.maxHp);
  assert.deepEqual(gains(h),{lateranoShip:3}); clean(h);
});
test('Makoto S1: substitutes heal at <=50%, return to arts attacks after recovery', () => {
  const {h,u,friend,e} = setup(0);
  friend.hp=3000;
  h.b.emit('dollSwitch',{unit:u,done:false}); h.run(3);
  assert.ok(friend.hp>3000);
  friend.hp=10000; const hp=e.hp; h.run(3);
  assert.ok(e.hp<hp);
  assert.ok(h.hooksOf('damaged').some(c=>c.source===u && c.dmg.type==='arts'));
  clean(h);
});
test('Makoto S2: fear execution uses threshold, does not execute healthy or fearless enemies', () => {
  const {h,u,e}=setup(1);
  h.b.emit('dollSwitch',{unit:u,done:false});h.run(1.1);
  e.hp=1; h.b.applyStatus(e,'fear',{duration:2,source:u});h.run(.2);
  assert.equal(e.alive,false);clean(h);
});
test('Makoto S3: weakness hits, fatal Thanatos becomes Orpheus, heal and dodge, no reset of remaining window', () => {
  const {h,u,e,friend}=setup(2);
  h.b.emit('dollSwitch',{unit:u,done:false});h.run(3);
  assert.ok(h.hooksOf('damaged').some(c=>c.source===u && c.dmg.type==='arts'));
  const remaining=u.findBuff('trait:substitute').timeLeft;
  friend.hp=1000;
  h.b.dealDamage(null,u,{amount:1e7,type:'true'});h.run(2.1);
  assert.ok(u.alive && u.trait.doll);
  assert.equal(u.s.blockCnt,2);assert.ok(friend.hp>1000);
  assert.equal(friend.s.dodgePhys,u.skill.bb['attack@prob']);
  assert.ok(u.findBuff('trait:substitute').timeLeft<remaining);
  assert.equal(u.profile.noAttack,true);
  clean(h);
});
test('Makoto: natural return all-out damage uses body ATK, substitute death never fires all-out', () => {
  const {h,u}=setup(1);h.b.emit('dollSwitch',{unit:u,done:false});h.run(22);
  const hits=h.hooksOf('damaged').filter(c=>c.dmg.tags?.includes('makotoAllOut'));
  assert.equal(hits.length,1);
  const talentScale=u.def.talents[1].bb.atk_scale;
  assert.equal(hits[0].dmg.amount,u.s.atk*talentScale, 'natural return uses body ATK and the selected data multiplier');
  const second=setup(1);second.h.b.emit('dollSwitch',{unit:second.u,done:false});second.h.run(1.1);
  second.h.b.dealDamage(null,second.u,{amount:1e7,type:'true'});second.h.run(22);
  assert.equal(second.h.hooksOf('damaged').filter(c=>c.dmg.tags?.includes('makotoAllOut')).length,0);
  clean(h);clean(second.h);
});

test('Makoto S3: injured allies and skill reactivation never switch Persona without fatal damage', () => {
  const { h, u, friend } = setup(2);
  h.b.emit('dollSwitch', { unit: u, done: false }); h.run(1.1);
  friend.hp = 1; h.run(3);
  assert.equal(u.form, 'makoto_s3a');
  u.skill.activate('test', { free: true }); h.run(1);
  assert.equal(u.form, 'makoto_s3a');
  h.b.dealDamage(null, u, { amount: 1, type: 'true' }); h.step();
  assert.equal(u.form, 'makoto_s3a');
  h.b.dealDamage(null, u, { amount: 1e7, type: 'true' }); h.run(1.1);
  assert.equal(u.form, 'makoto_s3b'); clean(h);
});
