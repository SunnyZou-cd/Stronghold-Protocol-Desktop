import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Lobby} from '../server/lobby.js';
import {SessionRegistry} from '../server/net.js';
import {getDataProfile} from '../server/data.js';
import {validateC2S} from '../shared/protocol.js';
import {VirtualScheduler} from '../server/match/scheduler.js';
import {makeMatch} from './match/harness.js';
import {buildBattleSpec,createBattleFromSpec} from '../server/sim/spec.js';
import {DataSource} from '../server/sim/simdata.js';
const quiet={info(){},warn(){},error(){}};
const roster=(r=false,o=false,c=false)=>getDataProfile(r,{operatorsEnabled:o,recruitsEnabled:c,log:quiet});
function setup(){const registry=new SessionRegistry(),lobby=new Lobby({registry,log:quiet,getDataProfile:(r,o,c)=>roster(r,o,c),matchOpts:{scheduler:new VirtualScheduler(),combat:'server'}});const player=name=>{const s=registry.create(name);s.connected=true;s.messages=[];s.ws={readyState:1,bufferedAmount:0,send:v=>s.messages.push(JSON.parse(v))};return s;};const send=(s,m)=>{assert.equal(validateC2S(m),null);return lobby.onMessage(s,m);};return {lobby,player,send};}
test('all 256 combinations keep independent flags, immutable profiles and one Sakiko',()=>{
 for(let f=0;f<256;f++){
  const h=setup(),p=h.player('host');try{
   const options={rhineEnabled:!!(f&1),operatorsEnabled:!!(f&2),recruitsEnabled:!!(f&4),doubleRounds:!!(f&8),relicsEnabled:!!(f&16),damageEnabled:!!(f&32),luckyEnabled:!!(f&64),targetedEnabled:!!(f&128)};
   assert.equal(h.send(p,{t:'room.create',mode:'coop',difficulty:'NORMAL',...options}).ok,true);
   const room=h.lobby.roomOf(p),cards=Object.values(room.data.chess).filter(c=>!c.isGolden&&!c.isDiy&&!c.isHidden);
   assert.equal(!!room.data.chess.chess_custom_6_wang_a,options.recruitsEnabled);
   assert.equal(cards.filter(c=>c.charId==='char_4182_oblvns').length,options.operatorsEnabled?1:0);
   assert.equal(new Set(cards.map(c=>c.charId)).size,cards.length);
   assert.equal(h.send(p,{t:'room.start'}).ok,true);const m=room.match;
   for(const k of Object.keys(options).filter(k=>k!=='doubleRounds'))assert.equal(m[k],options[k]);
   assert.equal(m.gd.bossRound,options.doubleRounds?18:14);
   assert.equal(m.dataProfile,(options.rhineEnabled?'rhine':'vanilla')+(options.operatorsEnabled?'-extra':'')+(options.recruitsEnabled?'-custom':''));
   assert.throws(()=>m.recruitsEnabled=false,TypeError);
  }finally{h.lobby.shutdown();}
 }
});
test('new options are host-only, clear readiness, sanitize recruits and lock after start',()=>{
 const h=setup(),a=h.player('a'),b=h.player('b');try{
  h.send(a,{t:'room.create',mode:'coop',difficulty:'NORMAL'});const room=h.lobby.roomOf(a);h.send(b,{t:'room.join',code:room.code});
  for(const mod of ['lucky','recruits','targeted']){
   assert.equal(h.send(b,{t:'room.setMod',mod,enabled:true}).error,'NOT_HOST');
   h.send(b,{t:'room.ready',ready:true});assert.equal(h.send(a,{t:'room.setMod',mod,enabled:true}).ok,true);
   assert.equal(room.seats.find(s=>s?.playerId===b.playerId).ready,false);assert.equal(b.messages.at(-1)[mod+'Enabled'],true);
  }
  assert.equal(h.send(b,{t:'room.loadout',entries:{chess_custom_6_wang_a:{skill:2}}}).ok,true);
  h.send(a,{t:'room.setMod',mod:'recruits',enabled:false});assert.equal(Object.hasOwn(b.loadout||{},'chess_custom_6_wang_a'),false);
  h.send(b,{t:'room.ready',ready:true});h.send(a,{t:'room.start'});
  for(const mod of ['lucky','recruits','targeted'])assert.equal(h.send(a,{t:'room.setMod',mod,enabled:false}).error,'ROOM_STARTED');
 }finally{h.lobby.shutdown();}
});
test('lucky includes bots, draws unique available tier-five cards once and consumes copies',()=>{
 for(const enabled of [false,true]){const h=makeMatch({humans:2,bots:2,luckyEnabled:enabled,seed:417}).start();try{
  const ps=[...h.m.players.values()],ids=ps.map(p=>p.luckyChess).filter(Boolean);assert.equal(ids.length,enabled?4:0);assert.equal(new Set(ids).size,ids.length);
  for(const id of ids){assert.equal(h.m.gd.chess(id).tier,5);assert.equal(h.m.pool.left(id),h.m.pool.cap(id)-1);}
  const copies=[...h.m.pool.entries].map(([id,e])=>[id,e.left]);h.m.grantLuckyChess();assert.deepEqual([...h.m.pool.entries].map(([id,e])=>[id,e.left]),copies);
 }finally{h.m.dispose();}}
});
test('targeted rewards choose active bonds and fall back when matching candidates are exhausted',()=>{
 for(const enabled of [false,true]){const h=makeMatch({targetedEnabled:enabled,seed:417});try{
  const ps=h.ps('p_0'),pool=h.m.pool;const [id]=[...pool.entries].find(([,e])=>e.tier===5),bond=h.m.gd.chess(id).bonds[0];
  ps.bonds={[bond]:{active:true,count:5}};ps.layers={[bond]:10};
  assert.equal(!!ps._rewardOfferPlan(3),enabled);
  if(enabled){const plan=ps._rewardOfferPlan(3);assert.equal(plan[0].mode,'weight');assert.equal(plan[0].mult,2.6);assert.equal(plan[1],null);assert.equal(plan[2],null);}
  for(let i=0;i<30;i++){ps.offers=[];const offer=ps.pushRewardOffer('test',{tier:5});assert.ok(offer);}
  for(const [cid,e]of pool.entries)if(h.m.gd.chess(cid).bonds.includes(bond))e.left=0;
  ps.offers=[];assert.ok(ps.pushRewardOffer('test',{tier:5}).slots.length>0);
 }finally{h.m.dispose();}}
});
test('server combat authenticates manual Wang placement, charges once and retains reconnect state',()=>{
 const data=roster(true,true,true),h=makeMatch({humans:2,data,recruitsEnabled:true,clientCombat:false});try{
  const spec=buildBattleSpec({battleId:'manual',fieldId:'f:p_0',seed:417,stageId:'act2autochess_m04',timeLimit:8,flags:{startOpCooldown:0},players:[{playerId:'p_0',dir:'RIGHT',units:[{uid:100,chessId:'chess_custom_6_wang_a',row:10,col:5,skillIndex:2,carryState:{sp:999}}]}],routes:[{start:[10,7],end:[10,7],motion:'WALK',checkpoints:[{type:'WAIT',time:100}]}],spawns:[{enemyKey:'enemy_1007_slime',count:1,time:3,route:0}]});
  const battle=createBattleFromSpec(spec,new DataSource(data,null),{quiet:true});battle.step();
  const field={fieldId:'f:p_0',kind:'normal',live:true,done:false,players:['p_0'],battle};h.m.fields=[field];
  const msg={t:'b.action',battleId:field.fieldId,seq:0,tick:0,action:{kind:'wang.place',uid:100,row:12,col:4}};
  assert.ok(h.m.handle('p_1',msg).error);assert.equal(h.m.handle('p_0',msg).ok,true);
  const stock=battle.allyUnits.find(u=>u.uid===100).mem.wang.stock,dp=battle.getPlayer('p_0').dp;
  assert.equal(h.m.handle('p_0',msg).ok,true);assert.equal(battle.getPlayer('p_0').dp,dp);assert.equal(battle.allyUnits.find(u=>u.uid===100).mem.wang.stock,stock);
  assert.ok(h.m.handle('p_0',{...msg,action:{...msg.action,col:3}}).error);assert.equal(battle.customActionLog.length,1);
  const snapshot=battle.snapshot();h.m.onDisconnect('p_0');h.m.onReconnect('p_0');assert.deepEqual(battle.snapshot(),snapshot);
 }finally{h.m.dispose();}
});
