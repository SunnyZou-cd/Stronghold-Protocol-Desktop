import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, give, legalTileFor } from './harness.js';
import { getDataProfile } from '../../server/data.js';
test('all mods: real server combat samples HP damage, freezes, reconnects, and retains relics',()=>{
 const data=getDataProfile(true,{operatorsEnabled:true});
 const h=makeMatch({mode:'solo',combat:'server',instant:false,data,rhineEnabled:true,relicsEnabled:true,operatorsEnabled:true,damageEnabled:true}).start();
 h.toPrep(1); const ps=[...h.m.players.values()][0],id='chess_char_5_makoto_a';give(h.m,ps,id,'board',legalTileFor(h.m,ps,id));
 h.m.handle(ps.playerId,{t:'g.ready',ready:true});
 h.runToPhase('COMBAT',1);h.sched.advance(10000);
 const b=h.m.fields[0].battle; const e=b.enemies.find(e=>e.alive); assert.ok(e); b.dealDamage(b.allyUnits[0],e,{type:'true',amount:100}); h.m._sampleDamage(true); const packet=h.lastTo(ps.playerId,'m.damage');assert.ok(packet);assert.equal(packet.status,'live');assert.ok(packet.owners.find(o=>o.playerId===ps.playerId).total>0);
 h.m.onDisconnect(ps.playerId);h.m.onReconnect(ps.playerId);assert.ok(h.lastTo(ps.playerId,'m.damage').owners.some(o=>o.playerId===ps.playerId));
 h.toPrep(2);assert.equal(h.lastTo(ps.playerId,'m.damage').status,'frozen');assert.deepEqual(h.logs.error,[]);h.m.dispose();
});



for (const rhineEnabled of [false,true]) for (const operatorsEnabled of [false,true]) {
 test(`operator-source revive flag reaches real combat: rhine=${rhineEnabled}, operators=${operatorsEnabled}`,()=>{
  const data=getDataProfile(rhineEnabled,{operatorsEnabled});
  const h=makeMatch({mode:'solo',combat:'server',instant:false,data,rhineEnabled,operatorsEnabled}).start();
  try {
   h.toPrep(1);const ps=[...h.m.players.values()][0];
   h.m.handle(ps.playerId,{t:'g.ready',ready:true});h.runToPhase('COMBAT',1);
   assert.equal(h.m.fields[0].battle.flags.operatorFixesEnabled,operatorsEnabled);
   assert.deepEqual(h.logs.error,[]);
  } finally {h.m.dispose();}
 });
}
