import { loadData } from '../../server/data.js';
import { setSimData, getDefaultSource } from '../../server/sim/simdata.js';
import { fileURLToPath } from 'node:url';
const EXTRA_DATA=loadData(fileURLToPath(new URL('../../data/rhine-extra',import.meta.url)));
setSimData(EXTRA_DATA);
import { setGameData } from '../../server/sim/content/support/index.js';
setGameData(EXTRA_DATA);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';

import { buildChess } from '../../tools/build-data.mjs';
import { buildNarant } from '../../tools/custom/narant.mjs';
const cards=JSON.parse(readFileSync(new URL('../../data/rhine-extra/chess.json',import.meta.url)));
const ds=getDefaultSource(),id='chess_char_5_narant_a';
const clean=h=>{assert.deepEqual(h.b.errors,[]);checkInvariants(h.b);};
function setup(gold=false,moduleId=null,layers=0,enemy=true,index=2){const cid=gold?id.replace(/_a$/,'_b'):id;
 const h=makeBattle({units:[{chessId:cid,row:10,col:5,skillIndex:index,moduleId}],bonds:{sargonShip:{active:true,count:3,tier:1,layers}},
 defs:{enemies:{e:enemyRec({key:'e',hp:1e8,atk:0,def:1000,res:0,speed:0})}},enemies:enemy?[{key:'e',pos:[10,6]}]:[],captureNoisy:true,autoFinish:false,timeLimit:100});h.step();return {h,u:h.unit(cid),e:h.enemies()[0]};}
test('Narant data rebuild: tier 5, sole Sargon bond, exact normal/elite garrison',()=>{
 const n=buildNarant(buildChess);for(const [cid,c]of Object.entries(n.chess)){assert.deepEqual(cards[cid],c);assert.equal(c.tier,5);assert.deepEqual(c.bonds,['sargonShip']);assert.equal(n.garrisons[c.garrisonIds[0]].bb.divide_num,8);assert.equal(n.garrisons[c.garrisonIds[0]].bb.atk,c.isGolden?.02:.01);}
});
for(const gold of [false,true])for(const layers of [0,7,8,15,16,80])test(`Narant ${gold?'elite':'normal'} ${layers} Sargon layers: complete groups of 8 only`,()=>{
 const {h,u}=setup(gold,'none',layers,false);const buff=u.findBuff(`gar:garrison_narant_${gold?'b':'a'}`);
 if(layers<8)assert.equal(buff,null);else assert.equal(buff.mods.atkPct,Math.floor(layers/8)*(gold?.02:.01));clean(h);
});
test('Narant garrison recomputes when Sargon crosses 8; other faction layers do not count',()=>{
 const {h,u}=setup(false,null,7,false);h.b.addLayers(u.ownerId,'sargonShip',1,'test');h.step();assert.equal(u.findBuff('gar:garrison_narant_a').mods.atkPct,.01);h.b.addLayers(u.ownerId,'lateranoShip',80,'test');h.step();assert.equal(u.findBuff('gar:garrison_narant_a').mods.atkPct,.01);clean(h);
});
for(const gold of [false,true])for(const moduleId of (gold?['none','uniequip_002_narant','uniequip_003_narant']:[null]))for(const index of [0,1,2])test(`Narant ${gold?'elite':'normal'} ${moduleId} S${index+1}: casts and attacks`,()=>{
 const {h,u}=setup(gold,moduleId,0,true,index);u.skill.rule='NEVER';u.skill.activate('test',{free:true});h.run(7);assert.ok(h.hooksOf('damaged').some(c=>c.source===u&&c.amount>0));assert.ok(u.trait.boomerangsOut>=0);clean(h);
});
test('modules: official choices and no-module stats restore for all four custom operators',()=>{
 const choices={chess_char_5_makoto_b:['uniequip_002_makoto'],chess_char_6_oblvns_b:['uniequip_002_oblvns'],chess_char_6_aglna2_b:[],chess_char_5_narant_b:['uniequip_002_narant','uniequip_003_narant']};
 for(const [cid,mods]of Object.entries(choices)){assert.deepEqual((cards[cid].modules??[]).map(m=>m.uniEquipId),mods);
 const none=ds.getChess(cid,{moduleId:'none'});for(const mod of mods){const d=ds.getChess(cid,{moduleId:mod});assert.ok(d.stats.atk>none.stats.atk);assert.equal(d.raw.module.active,true);}if(mods.length)assert.equal(none.raw.module.active,false);}
});
test('full-potential Narant X doubles nearby steals and both forms respect their selected data caps',()=>{
 for(const mod of ['uniequip_002_narant','none']){const {h,u,e}=setup(true,mod);u.skill.rule='NEVER';e.base.atk=10000;e.markDirty();
 const bb=u.def.talents[0].bb, doubled=mod==='uniequip_002_narant';
 h.b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});
 assert.equal(u.findBuff('narant:steal').mods.atkFlat,Math.min(bb['attack@steal_atk']*(doubled?2:1),bb['attack@steal_atk_max']));
 assert.equal(u.findBuff('narant:steal').mods.defFlat,Math.min(bb['attack@steal_def']*(doubled?2:1),bb['attack@steal_def_max']));
 for(let i=0;i<20;i++)h.b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});
 assert.equal(u.findBuff('narant:steal').mods.atkFlat,bb['attack@steal_atk_max']);assert.equal(u.findBuff('narant:steal').mods.defFlat,bb['attack@steal_def_max']);clean(h);}
});
test('Narant Y: after six seconds without damage gains 15% ATK; taking damage clears it',()=>{
 const {h,u}=setup(true,'uniequip_003_narant',0,false);h.run(6.2);assert.equal(u.findBuff('narant:unhurt').mods.atkPct,.15);h.b.dealDamage(null,u,{amount:1,type:'true'});h.run(.2);assert.equal(u.findBuff('narant:unhurt'),null);clean(h);
});
test('Makoto module: boosted substitute HP and talent; no module restores original values',()=>{
 for(const [mod,mul]of [['uniequip_002_makoto',1.68],['none',1.35]]){const cid='chess_char_5_makoto_b';const h=makeBattle({units:[{chessId:cid,row:10,col:5,skillIndex:0,moduleId:mod}],autoFinish:false,timeLimit:30});h.step();const u=h.unit(cid);u.skill.rule='NEVER';h.b.emit('dollSwitch',{unit:u,done:false});h.run(1.1);assert.ok(Math.abs(u.s.maxHp/u.base.maxHp-mul)<.001);clean(h);}
});
test('Narant Y: every fifth real boomerang return grants module SP; unequipped does not',()=>{
 for(const mod of ['uniequip_003_narant','none']){
  const {h,u}=setup(true,mod,0,true,1);u.skill.rule='NEVER';const reasons=[];
  h.b.on('spGain',c=>{if(c.unit===u)reasons.push(c.reason);});h.run(12);
  assert.equal(reasons.includes('module'),mod!=='none');clean(h);
 }
});
test('Sakiko module: two enemies grant 12 ASPD and strengthen note penetration; none restores base',()=>{
 for(const mod of ['uniequip_002_oblvns','none']){
  const cid='chess_char_6_oblvns_b';const h=makeBattle({units:[{chessId:cid,row:10,col:5,moduleId:mod}],defs:{enemies:{e:enemyRec({key:'e',hp:1e8,atk:0,speed:0})}},enemies:[{key:'e',pos:[10,6]},{key:'e',pos:[10,7]}],autoFinish:false,timeLimit:30});h.step();h.run(.2);const u=h.unit(cid);
  assert.equal(u.findBuff('sakiko:moduleTempo')?.mods.aspd,mod==='none'?undefined:12);
  assert.equal(u.def.talents[0].bb.def_penetrate_ratio,mod==='none'?.03:.05);
  assert.equal(u.def.talents[0].bb.max_cnt,mod==='none'?10:12);clean(h);
 }
});
