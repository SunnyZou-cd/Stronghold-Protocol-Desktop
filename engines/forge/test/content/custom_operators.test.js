import { resolveHit, effectiveProfile } from '../../server/sim/ai.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, chessRec, checkInvariants } from '../helpers/battleHarness.js';
import { applyCustomAction } from '../../server/sim/customActions.js';
import { COLS } from '../../server/sim/constants.js';
import { unitStatsEntry, loadoutOptions, checkLoadout } from '../../shared/protocol.js';

import { getDefaultSource, setSimData } from '../../server/sim/simdata.js';
import { absoluteRangeKeys } from '../../server/sim/targeting.js';
import { getDataProfile } from '../../server/data.js';
setSimData(getDataProfile(false,{recruitsEnabled:true,operatorsEnabled:true}));
const ids=['chess_custom_6_wang_a','chess_custom_5_chen3_a','chess_custom_5_kalts2_a','chess_custom_5_wisdel_a'];
test('Focused release exposes only S3 for three recruits and S2 for Esperanta in normal and elite loadouts',()=>{
 const ds=getDefaultSource(),get=id=>ds.raw.chess?.[id];
 for(const [i,id]of ids.entries()){
  const base=get(id),elite=get(id.replace(/_a$/,'_b')),index=i===2?1:2;
  assert.ok(base&&elite);assert.deepEqual(loadoutOptions(base,elite).skills,[index]);assert.equal(loadoutOptions(base,elite).defaultSkill,index);
  assert.equal(ds.getChess(id).skill.id,base.skills.find(s=>s.index===index).skillId);
  assert.ok(!/主动关闭|手动停止|随时停止/.test(base.skill.desc),'selected skill does not advertise manual stopping');
  for(const other of [0,1,2].filter(s=>s!==index))assert.equal(checkLoadout({[id]:{skill:other}},get).error,'BAD_TARGET');
 }
});
function scenario(id,index,extra={}){
 const damage=[],heals=[];
 const h=makeBattle({seed:417,timeLimit:100,autoFinish:false,defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})},chess:{patient:chessRec({id:'patient',skill:null,stats:{maxHp:1e8,atk:0}})}},
 units:[{chessId:id,row:10,col:5,uid:'caster',skillIndex:index},{chessId:'patient',row:11,col:6},...(extra.units||[])],enemies:[{key:'dummy',pos:[10,id.includes('chen3')?6:7]}],
 setup(b){b.on('damaged',c=>damage.push({amount:c.amount,type:c.type,tags:c.dmg.tags||[],skill:c.dmg.isSkill}));b.on('heal',c=>heals.push(c));}});
 h.run(0.1);h.unit('patient').hp=1e7;h.damage=damage;h.heals=heals;return h;
}
test('Wang S3 permits an enemy-occupied low floor inside its range, but never a high tile or ally slot',()=>{
 const row='##rrrrfrrrfrrrrrrrf##',h=makeBattle({autoFinish:false,flat:{rows:{10:row}},defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}},
 units:[{chessId:ids[0],uid:'caster',row:10,col:5,skillIndex:2}],enemies:[{key:'dummy',pos:[10,6]}]}),u=h.unit(ids[0]);h.run(0.1);
 const action={kind:'wang.place',uid:u.uid,row:10,col:6};assert.equal(applyCustomAction(h.b,u.ownerId,action).reason,'tile');
 u.skill.activate('test',{free:true});assert.equal(applyCustomAction(h.b,u.ownerId,{...action,col:5}).reason,'tile');
 const result=applyCustomAction(h.b,u.ownerId,action);assert.ok(result.ok,JSON.stringify(result));
 assert.equal(applyCustomAction(h.b,u.ownerId,{...action,row:0,col:0}).reason,'tile');checkInvariants(h.b);
});
for(const id of ids.flatMap(id=>[id,id.replace(/_a$/,'_b')]))for(const index of [id.includes('kalts2')?1:2])test(`${id} skill ${index+1}: specific combat path and clean simulation`,()=>{
 const extra=id.includes('wang')?{units:[{kind:'token',tokenId:'token_10064_wang_stone1',row:10,col:6,ownerUid:'caster'}]}:{};
 const h=scenario(id,index,extra),u=h.unit(id);
 assert.equal(u.skill.noSkill,false);
 assert.equal(u.def.skill.index,index);
 assert.ok(u.skill.activate('test',{free:true}));h.run(8);
 assert.ok(u.skill.activations>=1);
 if(id.includes('kalts2')){
  assert.ok(u.s.flags.liftoff&&u.s.flags.blockFly);
  if(index===1)assert.ok(h.damage.some(d=>d.tags.includes('kalts2:medical')&&d.type==='true'));
  else assert.ok(h.heals.length>0,'injured ally is healed');
 }else if(id.includes('wang')){
  assert.ok(u.mem.wang.stock>=0&&u.mem.wang.stock<=u.mem.wang.maxStock);
  assert.ok(h.damage.some(d=>d.tags.some(t=>t.startsWith('wang:'))),'connected piece damages entrant');
 }else if(id.includes('chen3')){
  if(index===1)assert.ok(h.damage.some(d=>d.tags.includes('chen3:slash')));
  if(index===2)assert.ok(h.damage.some(d=>d.tags.includes('chen3:wave')));
  assert.ok(h.damage.length>0);
 }else if(id.includes('wisdel'))assert.ok(h.damage.some(d=>d.tags.includes('aftershock')));
 else assert.ok(h.damage.some(d=>d.tags.includes('oblvns:note')));
 checkInvariants(h.b);
});
test('custom battle is deterministic with identical seed and loadout',()=>{
 const a=scenario(ids[3],2),b=scenario(ids[3],2);a.run(45);b.run(45);
 assert.deepEqual(a.damage,b.damage);assert.deepEqual(a.snapshot(),b.snapshot());
});
test('Wang S3 overflow prioritizes an enemy on unbuildable ground before an enemy on buildable ground',()=>{
 const h=makeBattle({autoFinish:false,flat:{rows:{10:'##rrrrfrrrfrrrrrrrf##'}},defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}},
 units:[{chessId:ids[0],uid:'caster',row:10,col:5,skillIndex:2}],enemies:[{key:'dummy',pos:[10,7]},{key:'dummy',pos:[10,6]}]});
 h.run(0.1);const u=h.unit('caster'),st=u.mem.wang,ps=h.b.getPlayer(u.ownerId),dp=ps.dp;st.stock=1;
 u.skill.activate('test',{free:true});assert.equal(st.nodes.length,1);assert.deepEqual([st.nodes[0].r,st.nodes[0].c],[10,6]);
 assert.equal(st.nodes[0].token,null);assert.equal(st.stock,st.maxStock);assert.equal(u.skill.ammoLeft,20);assert.equal(ps.dp,dp);checkInvariants(h.b);
});
test('Wang S3 never spends inventory automatically after its opening overflow placement',()=>{
 const h=scenario(ids[0],2),u=h.unit(ids[0]),st=u.mem.wang;st.stock=0;u.skill.activate('test',{free:true});
 for(const n of st.nodes)n.active=false;
 const stock=st.stock,ammo=u.skill.ammoLeft;h.run(0.5);
 assert.equal(st.stock,stock);assert.equal(u.skill.ammoLeft,ammo);assert.equal(st.nodes.length,0);checkInvariants(h.b);
});
test('Wang S3 manual placement creates one free follower and up to three timed extra followers and pays ammunition only for successful followers',()=>{
 const h=scenario(ids[0],2),u=h.unit(ids[0]),st=u.mem.wang;st.stock=0;u.skill.activate('test',{free:true});st.nodes=[];
 const ps=h.b.getPlayer(u.ownerId);ps.dp=h.b.flags.dpMax;const dp=ps.dp,stock=st.stock,ammo=u.skill.ammoLeft;
 const result=applyCustomAction(h.b,u.ownerId,{kind:'wang.place',uid:u.uid,row:10,col:7});assert.ok(result.ok,JSON.stringify(result));
 assert.equal(st.nodes.filter(n=>!n.token).length,1);assert.equal(u.skill.ammoLeft,ammo);for(const e of h.b.enemies)h.b.kill(e);h.run(1);const followers=st.nodes.filter(n=>!n.token);assert.equal(followers.length,4);assert.equal(u.skill.ammoLeft,ammo-3);
 assert.equal(st.stock,stock-1);assert.ok(Math.abs(ps.dp-(dp-h.b.tokenDef('token_10064_wang_stone1',u).stats.cost+h.b.flags.dpPerSec))<1e-6);checkInvariants(h.b);
});
test('Protocol Wang automatically ends S3 at zero inventory and refunds remaining ammunition',()=>{
 const h=scenario(ids[0],2),u=h.unit(ids[0]);u.mem.wang.stock=0;u.skill.activate('test',{free:true});u.mem.wang.stock=0;u.skill.ammoLeft=4;h.run(0.1);assert.equal(u.skill.active,false);assert.equal(u.mem.wang.stock,4);
});
test('Protocol Wang placing the last inventory piece automatically ends S3 even while pieces remain on the field',()=>{
 const h=scenario(ids[0],2),u=h.unit(ids[0]),st=u.mem.wang;st.stock=0;u.skill.activate('test',{free:true});
 st.nodes=[];st.stock=1;u.skill.ammoLeft=7;h.b.getPlayer(u.ownerId).dp=20;
 const result=applyCustomAction(h.b,u.ownerId,{kind:'wang.place',uid:u.uid,row:12,col:4});assert.ok(result.ok);
 assert.equal(st.stock,0);assert.equal(u.skill.ammoLeft,7);assert.ok(st.nodes.some(n=>n.active));
 h.run(0.1);assert.equal(u.skill.active,false);assert.equal(st.stock,7);checkInvariants(h.b);
});
for(const elite of [false,true])test(`Wisdel S3 explosion hits flying enemies with physical mitigation while only S3 aftershock gains aerial coverage (${elite?'elite':'normal'})`,()=>{
 const id=ids[3].replace(/_a$/,elite?'_b':'_a'),h=makeBattle({autoFinish:false,defs:{enemies:{ground:enemyRec({key:'ground',hp:1e8,def:400,speed:0,atk:0}),air:enemyRec({key:'air',hp:1e8,def:400,motion:'FLY',speed:0,atk:0})}},units:[{chessId:id,uid:'caster',row:10,col:5,skillIndex:2}],enemies:[{key:'ground',pos:[10,7]},{key:'air',pos:[10,7.8],route:2}]});
 h.run(.1);const u=h.unit('caster'),ground=h.b.enemies.find(e=>!e.isFlying),air=h.b.enemies.find(e=>e.isFlying),hits=[];assert.equal(air.isFlying,true);
 h.b.addBuff(u,{key:'test:no-attacks',flags:{disarm:true}});u.skill.activate('test',{free:true});const atk=u.s.atk,scale=u.def.raw.talents[0].bb['attack@bomb_atk_scale'];ground.mem[`wisdel:${u.id}`]=true;
 h.b.on('damaged',c=>{if(c.source===u)hits.push(c);});h.b.emit('wisdel:detonate',{source:u,target:ground,isSkill:true,guaranteed:true,atk});
 const explosions=hits.filter(c=>c.dmg.tags?.includes('wisdel:explosion'));assert.equal(explosions.length,2);assert.ok(explosions.some(c=>c.target===air));
 for(const c of explosions){assert.equal(c.type,'phys');assert.ok(Math.abs(c.amount-Math.max(atk*scale-400,atk*scale*.05))<1e-6);}
 hits.length=0;u.profile.afterHit(h.b,u,ground,{x:ground.x,y:ground.y,isSkill:true,atk});h.run(.7);
 assert.ok(hits.some(c=>c.target===ground&&c.dmg.tags?.includes('aftershock')));assert.ok(hits.some(c=>c.target===air&&c.dmg.tags?.includes('aftershock')));
 hits.length=0;u.profile.afterHit(h.b,u,ground,{x:ground.x,y:ground.y,isSkill:false,atk});h.run(.4);
 assert.ok(!hits.some(c=>c.target===air&&c.dmg.tags?.includes('aftershock')),'ordinary aftershock remains ground-only');checkInvariants(h.b);
});
for(const elite of [false,true])test(`Chen S3 turns again when the clockwise path is also blocked (${elite?'elite':'normal'})`,()=>{
 const rows={};for(const r of [9,10,11])rows[r]='##rrrrrrrffrrrrrrr##'.split('');rows[10][6]='h';rows[9][5]='h';
 const id=ids[1].replace(/_a$/,elite?'_b':'_a'),h=makeBattle({autoFinish:false,flat:{rows:Object.fromEntries(Object.entries(rows).map(([r,v])=>[r,v.join('')]))},defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}},units:[{chessId:id,uid:'caster',row:10,col:5,skillIndex:2}],enemies:[{key:'dummy',pos:[10,5.5]}]});
 h.run(.1);const u=h.unit('caster'),hits=[];h.b.on('damaged',c=>{if(c.dmg.tags?.includes('chen3:wave'))hits.push(c);});u.skill.activate('test',{free:true});const wave=u.mem.chenWave;wave.x=5.25;wave.y=9.75;
 assert.ok(h.runUntil(()=>wave.turns===1,.2));assert.equal(wave.turns,1);assert.deepEqual(wave.v,[-1,0]);assert.deepEqual([wave.x,wave.y],[5.25,9.75],'does not enter the second blocked tile');assert.equal(hits.length,1);
 assert.ok(h.runUntil(()=>wave.turns===2,.2));assert.equal(wave.turns,2);assert.deepEqual(wave.v.map(v=>v||0),[0,-1]);assert.ok(Math.abs(wave.x-5.2)<1e-9);assert.equal(wave.y,9.75);assert.equal(hits.length,2,'the next turn permits another hit');
 h.run(.2);assert.equal(wave.turns,2);assert.equal(hits.length,2,'straight movement does not repeat damage');assert.equal(h.b.errors.length,0);checkInvariants(h.b);
});
for(const form of ['a','b'])test(`Kaltsit S2 ${form} airborne talent blocks flyers but rejects ground blocking and ground attacks`,()=>{
 const id=`chess_custom_5_kalts2_${form}`,h=makeBattle({autoFinish:false,
  units:[{chessId:id,row:10,col:5,uid:'medic',skillIndex:1}],
  defs:{enemies:{ground:enemyRec({key:'ground',hp:1e8,speed:0,atk:0}),air:enemyRec({key:'air',hp:1e8,speed:0,atk:0,motion:'FLY'})}},
  enemies:[{key:'ground',pos:[10,5.5]},{key:'air',pos:[10,5.5],route:2}]});
 assert.ok(h.runUntil(()=>h.enemies().length===2,3));h.run(0.2);const u=h.unit('medic'),ground=h.enemies().find(e=>!e.isFlying),air=h.enemies().find(e=>e.isFlying);
 assert.equal(ground.blockedBy,null);assert.equal(air.blockedBy,u);assert.ok(u.blocking.includes(air));
 const before=u.hp;
 assert.equal(h.b.dealDamage(ground,u,{amount:100,type:'true',canDodge:false}),0);
 assert.equal(u.hp,before);
 assert.equal(h.b.dealDamage(air,u,{amount:100,type:'true',canDodge:false}),100);
 assert.equal(u.hp,before-100);
 u.skill.activate('test',{free:true});h.run(0.1);
 assert.equal(air.blockedBy,u);assert.equal(ground.blockedBy,null);checkInvariants(h.b);
});
for(const form of ['a','b'])test(`Wisdel S3 ${form} acquires aerial targets and splashes through the 2.5-tile boundary`,()=>{
 const hits=[],h=makeBattle({autoFinish:false,
  units:[{chessId:`chess_custom_5_wisdel_${form}`,uid:'wis',row:10,col:5,skillIndex:2}],
  defs:{enemies:{air:enemyRec({key:'air',hp:1e8,speed:0,atk:0,motion:'FLY'})}},
  setup(b){b.on('damaged',c=>hits.push(c));}});
 h.run(.1);const u=h.unit('wis'),main=h.spawn('air',{pos:[10,7],routeIndex:2}),edge=h.spawn('air',{pos:[10,9.49],routeIndex:2}),outside=h.spawn('air',{pos:[10,9.51],routeIndex:2});
 assert.ok(main.isFlying&&edge.isFlying&&outside.isFlying);
 main.base.tauntLevel=100;main.markDirty();
 h.run(.3);assert.ok(!hits.some(c=>c.source===u),'ordinary attacks cannot target flyers');
 u.skill.activate('test',{free:true});
 assert.ok(h.runUntil(()=>hits.some(c=>c.source===u&&c.target===main&&c.dmg.isAttack),8));
 h.b.addBuff(u,{key:'test:stop-next-shot',flags:{disarm:true}});h.run(.4);
 assert.ok(hits.some(c=>c.source===u&&c.target===edge&&c.dmg.isAttack&&c.dmg.isSplash),'aerial splash reaches 2.49 tiles');
 assert.ok(!hits.some(c=>c.source===u&&c.target===outside&&c.dmg.isAttack),'aerial splash excludes 2.51 tiles '+JSON.stringify({main:[main.x,main.y],edge:[edge.x,edge.y],outside:[outside.x,outside.y],hits:hits.filter(c=>c.dmg.isAttack).map(c=>[c.target.id,c.dmg.isSplash])}));
 assert.equal(u.skill.ammoLeft,5);checkInvariants(h.b);
});
for(const form of ['a','b'])test(`Wisdel S3 ${form} shares blast-lock priority and clears only the interrupted owner's lock`,()=>{
 const h=makeBattle({autoFinish:false,units:[{chessId:`chess_custom_5_wisdel_${form}`,uid:'first',row:10,col:5,skillIndex:2},{chessId:`chess_custom_5_wisdel_${form}`,uid:'second',row:10,col:4,skillIndex:2}],defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}}});
 h.run(.1);const first=h.unit('first'),second=h.unit('second');first.atkCd=second.atkCd=100;
 const locked=h.spawn('dummy',{pos:[10,7]}),other=h.spawn('dummy',{pos:[10,6]});h.run(.05);
 first.skill.activate('test',{free:true});second.skill.activate('test',{free:true});
 const one={attacker:first,targets:[locked],isSkill:true,profile:{}};h.b.emit('beforeAttack',one);
 assert.deepEqual(one.targets,[locked]);assert.ok(locked.mem.wisBlastLocks[first.id]>h.b.time);
 assert.ok(h.b.enemiesInKeys(second.rangeKeys,second,{canHitFly:true}).includes(locked),JSON.stringify({range:second.rangeKeys,alive:second.alive,deployed:second.deployed,lock:locked.mem.wisBlastLocks}));
 const two={attacker:second,targets:[other],isSkill:true,profile:{}};h.b.emit('beforeAttack',two);
 assert.deepEqual(two.targets,[locked],'another Wisdel prioritizes the shared locked target');
 h.b.retreat(first,{reason:'test',permanent:true});
 assert.equal(locked.mem.wisBlastLocks[first.id],undefined);assert.ok(locked.mem.wisBlastLocks[second.id]>h.b.time);
 h.b.applyStatus(second,'stun',{duration:1,source:other});h.run(.1);
 assert.equal(locked.mem.wisBlastLocks[second.id],undefined);checkInvariants(h.b);
});
for(const form of ['a','b'])test(`Wisdel S3 ${form} blast lock expires at the model's attack-finished event`,()=>{
 const h=scenario(ids[3].replace(/_a$/,`_${form}`),2),u=h.unit('caster'),e=h.b.enemies[0];u.atkCd=100;u.skill.activate('test',{free:true});
 h.b.emit('beforeAttack',{attacker:u,targets:[e],isSkill:true,profile:{}});
 const duration=(1.5-16/30)*100/u.s.aspd;
 assert.ok(Math.abs(u.mem.wisLock.until-h.b.time-duration)<1e-6);
 h.run(duration-.08);assert.ok(e.mem.wisBlastLocks[u.id]>h.b.time);
 h.run(.12);assert.equal(e.mem.wisBlastLocks[u.id],undefined);assert.equal(u.mem.wisLock,null);checkInvariants(h.b);
});
test('Wisdel elite S3 without a module retains one aftershock per bullet',()=>{
 const hits=[],h=makeBattle({autoFinish:false,timeLimit:100,
  units:[{chessId:'chess_custom_5_wisdel_b',uid:'wis',row:10,col:5,skillIndex:2,moduleId:'none'}],
  defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}},enemies:[{key:'dummy',pos:[10,7]}],
  setup(b){b.on('damaged',c=>hits.push(c));}});
 h.run(.1);const u=h.unit('wis');assert.equal(u.def.raw.module.active,false);assert.equal(u.profile.shockTimes,2);
 u.skill.activate('test',{free:true});assert.ok(h.runUntil(()=>!u.skill.active,60));
 h.b.addBuff(u,{key:'test:end-attacks',flags:{disarm:true}});h.run(1);
 assert.equal(hits.filter(c=>c.source===u&&c.dmg.isSkill&&c.dmg.isAttack&&!c.dmg.isSplash).length,6);
 assert.equal(hits.filter(c=>c.source===u&&c.dmg.isSkill&&c.dmg.tags?.includes('aftershock')).length,6);checkInvariants(h.b);
});
for(const firstSucceeds of [false,true])test(`Wisdel elite module rolls each ordinary aftershock independently (${firstSucceeds?'first succeeds':'second succeeds'})`,()=>{
 const h=makeBattle({autoFinish:false,units:[{chessId:'chess_custom_5_wisdel_b',uid:'wis',row:10,col:5,skillIndex:2}],defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}}});
 const u=h.unit('wis'),rolls=[],explosions=[];
 h.b.addBuff(u,{key:'test:no-further-attacks',persist:true,flags:{disarm:true}});h.run(1.1);u.atkCd=Infinity;const e=h.spawn('dummy',{pos:[10,7]});h.run(.05);
 h.b.rng.chance=p=>{if(p===0.15){rolls.push(h.b.time);return firstSucceeds||rolls.length===2;}return false;};
 h.b.on('damaged',c=>{if(c.source===u&&c.dmg.tags?.includes('wisdel:explosion'))explosions.push(h.b.time);});
 e.mem[`wisdel:${u.id}`]=true;
 u.profile.afterHit(h.b,u,e,{x:e.x,y:e.y,atk:u.s.atk,isSkill:false});
 h.run(5/30);
 assert.equal(rolls.length,1,JSON.stringify(rolls));assert.equal(explosions.length,firstSucceeds?1:0);
 assert.equal(e.mem[`wisdel:${u.id}`],true);
 h.run(.3);
 assert.equal(rolls.length,firstSucceeds?1:2);assert.equal(explosions.length,1);
 assert.equal(e.mem[`wisdel:${u.id}`],true);checkInvariants(h.b);
});
for(const elite of [false,true])test(`Wisdel actual main hit resolves explosion at 4f and shocks at 8f/12f (${elite?'elite':'normal'})`,()=>{
 const id=ids[3].replace(/_a$/,elite?'_b':'_a'),h=scenario(id,2),u=h.unit('caster');
 h.b.addBuff(u,{key:'test:hold',persist:true,flags:{disarm:true}});h.run(1.1);const e=h.b.enemies[0],events=[];
 u.skill.activate('test',{free:true});const start=h.b.time;
 h.b.on('damaged',c=>{if(c.source===u)events.push({tag:c.dmg.tags?.includes('wisdel:explosion')?'explosion':c.dmg.tags?.includes('aftershock')?'shock':'main',frame:Math.round((h.b.time-start)*30)});});
 const prof=effectiveProfile(u);prof.atkSnapshot=u.s.atk;
 resolveHit(h.b,u,prof,e,{isSkill:true,attackId:100},e.x,e.y);h.run(.5);
 assert.deepEqual(events.map(v=>[v.tag,v.frame]),elite?[['main',0],['explosion',4],['shock',8],['shock',12]]:[['main',0],['explosion',4],['shock',8]]);
 checkInvariants(h.b);
});
for(const reverse of [false,true])test(`Wisdel simultaneous casters detonate all marked enemies before shocks (${reverse?'B first':'A first'})`,()=>{
 const h=makeBattle({autoFinish:false,units:[{chessId:'chess_custom_5_wisdel_b',uid:'A',row:10,col:5,skillIndex:2},{chessId:'chess_custom_5_wisdel_a',uid:'B',row:10,col:4,skillIndex:2}],defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}}});
 h.run(1.1);const casters=[h.unit('A'),h.unit('B')];for(const u of casters)u.atkCd=Infinity;
 const es=[h.spawn('dummy',{pos:[10,7]}),h.spawn('dummy',{pos:[10,7.5]})];h.run(.1);
 for(const u of casters){u.skill.activate('test',{free:true});for(const e of es)e.mem[`wisdel:${u.id}`]=true;}
 const events=[],start=h.b.time;h.b.on('damaged',c=>{if(c.dmg.tags?.includes('wisdel:explosion')||c.dmg.tags?.includes('aftershock'))events.push({source:c.source,amount:c.amount,tag:c.dmg.tags.includes('wisdel:explosion')?'explosion':'shock',frame:Math.round((h.b.time-start)*30)});});
 for(const u of reverse?[...casters].reverse():casters)u.profile.afterHit(h.b,u,es[0],{x:es[0].x,y:es[0].y,atk:u.s.atk,isSkill:true});
 h.run(.5);const explosions=events.filter(v=>v.tag==='explosion');assert.equal(explosions.length,16);assert.ok(explosions.every(v=>v.frame===4));assert.ok(events.slice(0,16).every(v=>v.tag==='explosion'));
 for(const v of explosions)assert.ok(Math.abs(v.amount-v.source.s.atk*v.source.def.raw.talents[0].bb['attack@bomb_atk_scale'])<1e-6);
 for(const e of es)for(const u of casters)assert.equal(e.mem[`wisdel:${u.id}`],true);
 checkInvariants(h.b);
});
for(const first of ['B','A'])test(`Wisdel crossed residuals follow ${first}'s first shock then the other caster's shock`,()=>{
 const h=makeBattle({autoFinish:false,units:[{chessId:'chess_custom_5_wisdel_a',uid:'B',row:10,col:5,skillIndex:2},{chessId:'chess_custom_5_wisdel_a',uid:'A',row:10,col:4,skillIndex:2}],defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}}});
 h.run(1.1);const units=[h.unit('B'),h.unit('A')];for(const u of units)u.atkCd=Infinity;
 const e=h.spawn('dummy',{pos:[10,7]});h.run(.1);for(const u of units){u.skill.activate('test',{free:true});e.mem[`wisdel:${u.id}`]=true;}
 const events=[],start=h.b.time;h.b.on('damaged',c=>{if(c.dmg.tags?.includes('wisdel:explosion')||c.dmg.tags?.includes('aftershock'))events.push([c.source===units[0]?'B':'A',c.dmg.tags.includes('wisdel:explosion')?'explosion':'shock',Math.round((h.b.time-start)*30)]);});
 const one=h.unit(first),two=h.unit(first==='B'?'A':'B');one.profile.afterHit(h.b,one,e,{x:e.x,y:e.y,atk:one.s.atk,isSkill:true});h.run(4/30);
 two.profile.afterHit(h.b,two,e,{x:e.x,y:e.y,atk:two.s.atk,isSkill:true});h.run(.5);
 assert.deepEqual(events,[['B','explosion',4],['A','explosion',4],[first,'shock',8],['B','explosion',8],['A','explosion',8],[first==='B'?'A':'B','shock',12]]);
 for(const u of units)assert.equal(e.mem[`wisdel:${u.id}`],true);checkInvariants(h.b);
});
for(const form of ['a','b'])test(`Wang S3 ${form} automatically replenishes empty inventory without a basic attack target`,()=>{
 const id=`chess_custom_6_wang_${form}`,h=makeBattle({autoFinish:false,units:[{chessId:id,uid:'wang',row:10,col:5,skillIndex:2}],defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0})}},enemies:[{key:'dummy',pos:[12,7]}]});
 h.run(.1);const u=h.unit('wang');u.mem.wang.stock=0;u.skill.setSpTotal(u.skill.spCost);h.run(.2);
 assert.equal(u.skill.active,true);assert.equal(u.mem.wang.stock,u.mem.wang.maxStock);
 assert.equal(u.mem.wang.stock,8);assert.equal(u.mem.wang.nodes.length,0,'eight replenished pieces fit the full-potential inventory');checkInvariants(h.b);
});
for(const form of ['a','b'])test(`Wang S3 ${form} naturally refills and damages in three successive cycles`,()=>{
 const id=`chess_custom_6_wang_${form}`,starts=[],ends=[],hits=[];
 const h=makeBattle({autoFinish:false,timeLimit:300,units:[{chessId:id,uid:'wang',row:10,col:5,skillIndex:2}],defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e9,speed:0,atk:0})}},enemies:[{key:'dummy',pos:[12,5]}],setup(b){
  b.on('skillStart',c=>{if(c.unit.uid==='wang')starts.push({time:b.time,stock:c.unit.mem.wang.stock});});
  b.on('skillEnd',c=>{if(c.unit.uid==='wang')ends.push({time:b.time,reason:c.reason});});
  b.on('damaged',c=>{if(c.dmg.tags?.includes('wang:stone'))hits.push({time:b.time,amount:c.amount});});
 }});
 h.run(.1);const u=h.unit('wang');assert.equal(applyCustomAction(h.b,u.ownerId,{kind:'wang.place',uid:u.uid,row:12,col:4}).ok,true);
 h.run(220);assert.equal(starts.length,3);assert.equal(ends.length,3);
 for(let i=0;i<3;i++){assert.equal(starts[i].stock,8);assert.equal(ends[i].reason,'empty');assert.ok(hits.some(v=>v.time>=starts[i].time&&v.time<=ends[i].time&&v.amount>0));}
 assert.ok(hits.some(v=>v.time>ends[2].time),'returned pieces keep automatically deploying and damaging');
 assert.deepEqual(h.b.errors,[]);checkInvariants(h.b);
});
for(const form of ['a','b'])for(const inside of [true,false])test(`Wang S3 ${form} ${inside?'inside':'outside'} range controls timed paid followers`,()=>{
 const id=`chess_custom_6_wang_${form}`,h=makeBattle({autoFinish:false,flat:{rows:{9:'##rrrrrrrrrrrrrrrrr##',10:'##rrrrrrrrrrrrrrrrr##',11:'##rrrrrrrrrrrrrrrrr##',12:'##rrrrrrrrrrrrrrrrr##'}},units:[{chessId:id,uid:'wang',row:10,col:5,skillIndex:2}]});
 h.run(.1);const u=h.unit('wang'),st=u.mem.wang;st.stock=0;u.skill.activate('test',{free:true});st.nodes=[];
 const col=inside?7:3;assert.equal(u.rangeKeys.includes(10*COLS+col),inside);h.b.getPlayer(u.ownerId).dp=h.b.flags.dpMax;
 assert.ok(applyCustomAction(h.b,u.ownerId,{kind:'wang.place',uid:u.uid,row:10,col}).ok);
 const count=()=>st.nodes.filter(n=>!n.token).length;assert.equal(count(),1);assert.equal(u.skill.ammoLeft,20);
 h.step();for(let i=1;i<=3;i++){h.run(8/30);assert.equal(count(),inside?i:1);h.run(1/30);assert.equal(count(),inside?i+1:1);assert.equal(u.skill.ammoLeft,inside?20-i:20);}
 for(const n of st.nodes.filter(n=>!n.token)){assert.equal(Math.abs(n.r-10)+Math.abs(n.c-col),1);assert.ok(h.b.grid.canStand(n.r,n.c,{ranged:true}));}checkInvariants(h.b);
});
