import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPluginRegistry} from '../server/plugins/registry.js';
import {buildContentSet,contentSetFiles} from '../server/plugins/contentSet.js';
import {applyPatches} from '../shared/plugins/patch.js';
import {leleFlags,applyLelePackages} from '../shared/lelePlugins.js';
import {getData} from '../server/data.js';
import {makeMatch} from './match/harness.js';
import fs from 'node:fs';
const registry=createPluginRegistry({pluginsDir:'plugins',dataDir:'data',publicDir:'public',simDir:'server/sim',sharedDir:'shared'});
const features=['rounds','factions','relics','operators','damage','lucky','recruits','targeted'];
const ids=features.map(k=>'lele-'+k);
const build=names=>{const s=buildContentSet({registry,ids:names});assert.deepEqual(s.problems,[]);return s;};
test('native original content has no active Lele feature; plugins validate independently',()=>{
 const vanilla=build([]);assert.ok(vanilla.vanilla);assert.ok(Object.values(leleFlags(vanilla.data)).every(v=>!v));
 for(const id of ids){const s=build([id]);assert.equal(s.vanilla,false);assert.equal(Object.values(leleFlags(s.data)).filter(Boolean).length,1);assert.notEqual(s.cs,vanilla.cs);}
});
test('all eight combine deterministically; extra rounds and duplicate Wisdel resolve',()=>{
 const s=build(ids),reverse=build([...ids].reverse());assert.equal(s.cs,reverse.cs);
 assert.ok(Object.values(leleFlags(s.data)).every(Boolean));
 for(const [id,mode]of Object.entries(s.data.config.modes))if(id!=='mode_training_1')assert.equal(Object.keys(mode.rounds).length, Object.keys(getData().config.modes[id].rounds).length + 4);
 const wisdels=Object.values(s.data.chess).filter(c=>!c.isGolden&&!c.isDiy&&!c.isHidden&&c.charId==='char_1035_wisdel');assert.equal(wisdels.length,1);assert.match(wisdels[0].chessId,/kazdel/);
 assert.ok(s.data.chess.chess_rhine_aphris_a);assert.ok(contentSetFiles(s).has('data/config.json'));
});
test('plugins refuse an unadapted host and payloads cannot write prototype keys',()=>{
 const official=structuredClone(getData());delete official.config.economy.leleHost;
 const doc=JSON.parse(fs.readFileSync('plugins/lele-relics/data/feature.json'));
 assert.equal(applyPatches(official,doc.ops,{pluginId:'lele-relics'}).problems[0].code,'PLUGIN_PATCH_PATH');
 const bad=structuredClone(getData());bad.config.economy.leleHost.packages.relics={api:1,feature:'relics',flag:'relicsEnabled',changes:[{path:['config','__proto__','polluted'],value:true}]};
 assert.throws(()=>applyLelePackages(bad,['lele-relics']),/Invalid feature edit/);assert.equal({}.polluted,undefined);
});
test('match freezes selected feature flags, reaches preparation and retains them for reconnect',()=>{
 const s=build(ids);const h=makeMatch({mode:'coop',humans:1,bots:1,fake:true,data:s.data});
 try{h.start();h.toPrep(1);assert.equal(h.m.relicsEnabled,true);assert.equal(h.m.rhineEnabled,true);assert.equal(h.m.gd.raw.chess.chess_rhine_aphris_a.name,'谬因');assert.equal(h.m.errorCount,0);h.m.onDisconnect('p_0');h.m.onReconnect('p_0');assert.equal(h.m.relicsEnabled,true);assert.equal(h.m.errorCount,0);}finally{h.m.dispose();}
});
