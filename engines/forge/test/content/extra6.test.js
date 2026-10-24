import { loadData } from '../../server/data.js';
import { setSimData } from '../../server/sim/simdata.js';
import { fileURLToPath } from 'node:url';
const EXTRA_DATA=loadData(fileURLToPath(new URL('../../data/rhine-extra',import.meta.url)));
setSimData(EXTRA_DATA);
import { setGameData } from '../../server/sim/content/support/index.js';
setGameData(EXTRA_DATA);
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, chessRec, checkInvariants } from '../helpers/battleHarness.js';
import { buildChess } from '../../tools/build-data.mjs';
import { buildExtraOperators } from '../../tools/custom/operators.mjs';
import { GameData } from '../../server/match/gamedata.js';
import { SharedPool } from '../../server/match/pool.js';
const DATA=EXTRA_DATA;
const cards=JSON.parse(readFileSync(new URL('../../data/rhine-extra/chess.json',import.meta.url)));
const ids=['chess_char_6_aglna2_a','chess_char_6_oblvns_a'];
const clean=h=>{assert.deepEqual(h.b.errors,[]);checkInvariants(h.b);};
function setup(id,index=2,gold=false,fly=false){
 const cid=gold?id.replace(/_a$/,'_b'):id;
 const h=makeBattle({units:[{chessId:cid,row:10,col:5,skillIndex:index}],defs:{chess:cards,
   enemies:{e:enemyRec({key:'e',hp:1e8,atk:0,speed:0,def:300,res:20,motion:fly?'FLY':'WALK'})}},
 enemies:[{key:'e',pos:[10,6]},{key:'e',pos:[10,7]}],captureNoisy:true,autoFinish:false,timeLimit:200});
 h.step();return {h,u:h.unit(cid),e:h.enemies()[0]};
}
test('extra operators: tier 6, exact single faction, no garrison, price/merge/golden and five solo / ten co-op copies in pool',()=>{
 const solo=new SharedPool(new GameData(DATA,'mode_single_normal'));
 const pool=new SharedPool(new GameData(DATA,'mode_multi_normal'),{banned:[]});
 for(const [i,id]of ids.entries()){
  for(const cid of [id,id.replace(/_a$/,'_b')]){const c=cards[cid];assert.equal(c.tier,6);assert.deepEqual(c.bonds,[i?'emptyShip':'siracusaShip']);assert.deepEqual(c.garrisonIds,[]);assert.equal(c.price,4);assert.equal(c.sellPrice,1);assert.equal(c.skills.length,3);}
  assert.equal(cards[id].upgradeNum,3);assert.equal(solo.cap(id),5);assert.equal(pool.entries.get(id).cap,10);
 }
 for(const [id,c]of Object.entries(buildExtraOperators(buildChess)))assert.deepEqual(cards[id],c);
});
for(const id of ids)for(const gold of [false,true])for(const index of [0,1,2])test(`${id} ${gold?'elite':'normal'} S${index+1} casts and damages without content errors`,()=>{
 const {h,u}=setup(id,index,gold);u.skill.rule='NEVER';if(!u.skill.active)assert.equal(u.skill.activate('test',{free:true}),true);
 h.run(8);assert.ok(h.hooksOf('damaged').some(c=>c.source===u&&c.amount>0));clean(h);
});
test('Angelina: S1 takes off on deployment and gives bonus arts per attack; no ground attacks received',()=>{
 const {h,u}=setup(ids[0],0);assert.equal(u.skill.active,true);assert.equal(u.s.flags.liftoff,true);
 h.run(3);assert.ok(h.hooksOf('damaged').some(c=>c.dmg.tags?.includes('aglna2Extra')));clean(h);
});
test('Angelina: S2 levitates ground enemies and grounds flying enemies for the blackboard duration',()=>{
 for(const flying of [false,true]){const {h,u,e}=setup(ids[0],1,false,flying);u.skill.rule='NEVER';u.skill.activate('test',{free:true});
 assert.equal(e.s.flags[flying?'groundbind':'levitate'],true);assert.equal(e.isFlying,!flying);h.run(3);clean(h);}
});
test('Sakiko: produces notes and gains attack SP even before enemies enter range',()=>{
 const {h,u}=setup(ids[1],2);u.skill.rule='NEVER';for(const e of h.enemies())h.b.kill(e);const sp=u.skill.sp;
 h.run(4);assert.ok(u.skill.sp>sp);assert.ok(u.mem.sakikoNotes.length);clean(h);
});
test('Sakiko S3: strongest RES takes physical notes, strongest DEF takes arts notes',()=>{
 const {h,u}=setup(ids[1],2);const [a,z]=h.enemies();a.base.res=90;a.markDirty();z.base.def=900;z.markDirty();
 u.skill.rule='NEVER';u.skill.activate('test',{free:true});h.run(4);
 const notes=h.hooksOf('damaged').filter(c=>c.source===u&&c.dmg.tags?.includes('sakikoNote'));
 assert.ok(notes.some(c=>c.target===a&&c.type==='phys'));assert.ok(notes.some(c=>c.target===z&&c.type==='arts'));clean(h);
});
test('Sakiko: damage accumulates Fever; S3 survives fatal damage only during Fever and retires on its end',()=>{
 const {h,u,e}=setup(ids[1],2);u.skill.rule='NEVER';
 for(let i=0;i<150;i++)h.b.dealDamage(u,e,{amount:1,type:'true'});
 const f=h.b._sakikoFever.get(u.ownerId);assert.equal(f.value,450);
 u.skill.activate('test',{free:true});assert.equal(f.value,0);assert.ok(f.until>h.b.time);
 h.b.dealDamage(null,u,{amount:1e8,type:'true'});assert.equal(u.alive,true);h.run(20.2);assert.equal(u.alive,false);clean(h);
 const other=setup(ids[1],2);other.h.b.dealDamage(null,other.u,{amount:1e8,type:'true'});assert.equal(other.u.alive,false);clean(other.h);
});
