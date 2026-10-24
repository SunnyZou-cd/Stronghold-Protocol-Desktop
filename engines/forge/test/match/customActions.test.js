import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMatch as baseMakeMatch} from './harness.js';
import {getDataProfile} from '../../server/data.js';
const DATA=getDataProfile(true,{recruitsEnabled:true,operatorsEnabled:true});
const makeMatch=o=>baseMakeMatch({...o,data:DATA,recruitsEnabled:true,operatorsEnabled:true});
import {buildBattleSpec,createBattleFromSpec} from '../../server/sim/spec.js';
import {DataSource} from '../../server/sim/simdata.js';
import {validateC2S} from '../../shared/protocol.js';
import {COLS} from '../../server/sim/constants.js';
function fixture(){
 const h=makeMatch({humans:2,clientCombat:true,clients:false});
 const spec=buildBattleSpec({battleId:'manual',fieldId:'f:p_0',seed:417,stageId:'act2autochess_m04',timeLimit:5,
  players:[{playerId:'p_0',dir:'RIGHT',units:[{uid:100,chessId:'chess_custom_6_wang_a',row:10,col:5,skillIndex:2}]}],
  routes:[{start:[10,7],end:[10,7],motion:'WALK',checkpoints:[{type:'WAIT',time:100}]}],spawns:[{enemyKey:'enemy_1007_slime',count:1,time:3,route:0}]});
 const f={spec,battleId:'manual',fieldId:'f:p_0',kind:'normal',mode:'client',authority:'p_0',players:['p_0'],startAt:h.sched.now(),done:false,cc:true};h.m.fields=[f];
 const msg={t:'b.action',battleId:'manual',seq:0,tick:3,action:{kind:'wang.place',uid:100,row:12,col:4}};return {h,f,msg};
}
test('Server validates manual placement, publishes its replay log, and retries are idempotent',()=>{
 const {h,f,msg}=fixture();assert.equal(validateC2S(msg),null);assert.equal(h.m.handle('p_0',msg).ok,true);
 assert.equal(f.spec.customActions.length,1);assert.equal(f.spec.customActions[0].requestSeq,0);
 assert.equal(h.m.handle('p_0',msg).ok,true);assert.equal(f.spec.customActions.length,1);
 assert.ok(h.allTo('p_0','b.start').every(m=>m.spec.customActions.length===1));
 const replay=createBattleFromSpec(f.spec,new DataSource(DATA,null),{quiet:true});
 while(replay.tickCount<f.actionBattle.tickCount)replay.step();assert.deepEqual(replay.snapshot(),f.actionBattle.snapshot());
 assert.ok(h.m.handle('p_0',{...msg,action:{...msg.action,col:3}}).error);
 h.m.dispose();
});
test('Server rejects foreign, occupied, future and malformed inputs without adding replay commands',()=>{
 const {h,f,msg}=fixture();assert.ok(h.m.handle('p_1',msg).error);
 assert.ok(h.m.handle('p_0',{...msg,tick:31}).error);
 assert.ok(h.m.handle('p_0',{...msg,action:{...msg.action,row:10,col:5}}).error);
 assert.equal(f.spec.customActions,undefined);assert.equal(f.actionBattle,null);
 assert.equal(h.m.handle('p_0',msg).ok,true,'a refused input must not poison the next replay');
 assert.notEqual(validateC2S({...msg,action:{...msg.action,row:-1}}),null);h.m.dispose();
});
