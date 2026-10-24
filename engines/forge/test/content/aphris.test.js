import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDataProfile} from '../../server/data.js';
import {makeBattle as baseMakeBattle,enemyRec,chessRec,checkInvariants} from '../helpers/battleHarness.js';
import {DataSource} from '../../server/sim/simdata.js';
import {loadoutOptions} from '../../shared/protocol.js';
import {makeMatch} from '../match/harness.js';
const data=getDataProfile(true),id='chess_rhine_aphris_a';
const makeBattle=o=>baseMakeBattle({...o,data:new DataSource({...data,chess:{...data.chess,...o.defs?.chess},enemies:{...data.enemies,...o.defs?.enemies}},null)});
test('Aphris belongs only to Rhine profiles, exposes S2 and preserves official DIY token variants',()=>{
 for(const r of [false,true])for(const o of [false,true])for(const c of [false,true]){
  const d=getDataProfile(r,{operatorsEnabled:o,recruitsEnabled:c});assert.equal(!!d.chess[id],r);
  if(r){assert.deepEqual(d.chess[id].bonds,['rhineShip']);assert.equal(d.chess[id].tier,5);assert.deepEqual(loadoutOptions(d.chess[id],d.chess.chess_rhine_aphris_b).skills,[1]);
   const t=d.tokens.token_10070_aphris_pc;assert.ok(t.variants[id]);for(const key of Object.keys(getDataProfile(false).tokens.token_10070_aphris_pc?.variants||{}))assert.ok(t.variants[key]);}
 }
});
for(const form of ['a','b'])test(`Aphris ${form} S2 deals periodic arts damage along a board-length straight beam`,()=>{
 const hits=[],h=makeBattle({data,autoFinish:false,defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e8,speed:0,atk:0,res:0})}},units:[{chessId:`chess_rhine_aphris_${form}`,uid:'aph',row:10,col:5,skillIndex:1}],enemies:[{key:'dummy',pos:[10,16]},{key:'dummy',pos:[11,16]}],setup(b){b.on('damaged',c=>hits.push(c));}}),u=h.unit('aph');
 h.run(.1);assert.equal(u.skill.activate('test',{free:true}),true);h.run(2);
 const far=h.b.enemies.find(e=>Math.round(e.y)===10),side=h.b.enemies.find(e=>Math.round(e.y)===11);
 assert.ok(hits.filter(x=>x.target===far&&x.source===u&&x.type==='arts').length>=3);assert.equal(hits.filter(x=>x.target===side).length,0);
 checkInvariants(h.b);assert.deepEqual(h.b.errors,[]);
});
test('Aphris relay grants attack, ally penetration and expires at 25 seconds',()=>{
 const h=makeBattle({data,autoFinish:false,timeLimit:40,defs:{chess:{friend:chessRec({id:'friend',skill:null})}},units:[{chessId:id,uid:'aph',row:10,col:5},{chessId:'friend',uid:'ally',row:10,col:6}]}),u=h.unit('aph'),friend=h.unit('ally'),base=u.s.atk;
 h.run(.1);const token=h.b.spawnToken(u,'token_10070_aphris_pc',11,6);assert.ok(token);h.run(.4);
 assert.ok(u.s.atk>base);assert.ok(friend.s.resIgnoreFlat>=10);assert.equal(token.profile.noAttack,true);assert.equal(token.s.flags.untargetable,true);
 h.run(25.1);assert.equal(token.deployed,false);h.run(.4);assert.equal(u.s.atk,base);checkInvariants(h.b);
});
test('Rhine Aphris shared pool merge and reconnect are valid',()=>{
 let h;for(let seed=1;seed<100;seed++){const candidate=makeMatch({data,rhineEnabled:true,humans:2,clientCombat:false,seed});if(candidate.m.pool.has(id)){h=candidate.start();break;}candidate.m.dispose();}assert.ok(h);try{
  h.toPrep(1);const p=h.ps('p_0');p.board.clear();p.hand.fill(null);p.temp.fill(null);p.funds=100;
  for(let i=0;i<3;i++)assert.ok(p.acquireChess(id));const piece=p.hand.find(x=>x?.id==='chess_rhine_aphris_b');assert.ok(piece);assert.equal(piece.poolCopies,3);assert.equal(p.loadoutFor(data.chess[piece.id]).skillIndex,1);
  const before=h.m.publicView().dataProfile;h.m.onDisconnect(p.playerId);h.m.onReconnect(p.playerId);assert.equal(h.m.publicView().dataProfile,before);assert.equal(h.m.rhineEnabled,true);
 }finally{h.m.dispose();}
});
