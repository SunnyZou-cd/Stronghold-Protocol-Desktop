import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildBattleSpec,createBattleFromSpec,jsonClone} from '../../server/sim/spec.js';
import {getDefaultSource,setSimData} from '../../server/sim/simdata.js';
import {COLS} from '../../server/sim/constants.js';
import {getDataProfile} from '../../server/data.js';
setSimData(getDataProfile(true,{recruitsEnabled:true,operatorsEnabled:true}));
const input={tick:3,playerId:'p1',action:{kind:'wang.place',uid:100,row:12,col:4}};
function spec(actions=[]){return buildBattleSpec({battleId:'manual',fieldId:'manual',seed:417,stageId:'act2autochess_m04',timeLimit:5,
 players:[{playerId:'p1',dir:'RIGHT',units:[{uid:100,chessId:'chess_custom_6_wang_a',row:10,col:5,skillIndex:2}]}],
 routes:[{start:[10,7],end:[10,7],motion:'WALK',checkpoints:[{type:'WAIT',time:100}]}],spawns:[{enemyKey:'enemy_1007_slime',count:1,time:3,route:0}],customActions:actions});}
test('A live queued Wang input replays from JSON with identical snapshots, DP, stock and result',()=>{
 const ds=getDefaultSource(),live=createBattleFromSpec(spec(),ds,{quiet:true});
 for(let i=0;i<3;i++)live.step();assert.ok(live.queueCustomAction(input));
 const replay=createBattleFromSpec(jsonClone(spec(live.customActionLog)),ds,{quiet:true});
 for(let i=0;i<3;i++)replay.step();live.step();replay.step();
 assert.equal(live.customActionResults[0].ok,true);assert.deepEqual(live.customActionResults,replay.customActionResults);
 assert.deepEqual(live.snapshot(),replay.snapshot());assert.deepEqual(live.players.map(p=>p.dp),replay.players.map(p=>p.dp));
 while(!live.finished)live.step();while(!replay.finished)replay.step();assert.deepEqual(live.result(),replay.result());
 assert.equal(live.errors.length,0);assert.equal(replay.errors.length,0);
});
test('Live inputs reject backdating and are copied before queuing',()=>{
 const b=createBattleFromSpec(spec(),getDefaultSource(),{quiet:true});b.step();
 assert.equal(b.queueCustomAction({...input,tick:0}),false);assert.equal(b.queueCustomAction({...input,tick:NaN}),false);
 const a=jsonClone(input);assert.ok(b.queueCustomAction(a));a.action.row=-1;
 for(let i=0;i<3;i++)b.step();assert.equal(b.customActionResults[0].ok,true);assert.equal(b.customActionLog[0].action.row,12);
});
for(const form of ['a','b'])for(const inside of [true,false])test(`Wang S3 ${form} ${inside?'inside':'outside'} timed burst and damage survive JSON input replay`,()=>{
 const make=actions=>buildBattleSpec({battleId:'wang-s3-replay',fieldId:'wang-s3-replay',seed:417,stageId:'act2autochess_m04',timeLimit:8,flags:{startOpCooldown:0},
  players:[{playerId:'p1',dir:'RIGHT',units:[{uid:100,chessId:`chess_custom_6_wang_${form}`,row:10,col:5,skillIndex:2,carryState:{sp:999}}]}],
  routes:[{start:[11,inside?7:3],end:[11,inside?7:3],motion:'WALK',checkpoints:[{type:'WAIT',time:100}]}],
  spawns:[{enemyKey:'enemy_1007_slime',count:1,time:1.2,route:0}],enemyOverrides:{enemy_1007_slime:{stats:{maxHp:1e7,atk:0,moveSpeed:0,res:60}}},customActions:actions});
 const ds=getDefaultSource(),live=createBattleFromSpec(make([]),ds,{quiet:true});for(let i=0;i<3;i++)live.step();
 const u=live.allyUnits.find(u=>u.uid===100);assert.equal(u.skill.active,true);
 const action={tick:live.tickCount,playerId:'p1',action:{kind:'wang.place',uid:100,row:11,col:inside?7:3}};assert.ok(live.queueCustomAction(action));
 const replay=createBattleFromSpec(jsonClone(make(live.customActionLog)),ds,{quiet:true});for(let i=0;i<3;i++)replay.step();
 const hits=[[],[]];for(const [i,b]of [live,replay].entries())b.on('damaged',c=>{if(c.dmg.tags?.includes('wang:stone'))hits[i].push({tick:b.tickCount,amount:c.amount,piece:c.dmg.tags.find(t=>t.startsWith('wang:piece:'))});});
 while(!live.finished){live.step();replay.step();assert.deepEqual(live.snapshot(),replay.snapshot());assert.deepEqual(live.players.map(p=>p.dp),replay.players.map(p=>p.dp));}
 assert.equal(live.customActionResults[0].ok,true);assert.deepEqual(live.customActionResults,replay.customActionResults);assert.deepEqual(hits[0],hits[1]);
 assert.ok(hits[0].length>0);assert.ok(hits[0].every(h=>h.amount>0));assert.deepEqual(live.result(),replay.result());assert.deepEqual(live.errors,[]);assert.deepEqual(replay.errors,[]);
});
