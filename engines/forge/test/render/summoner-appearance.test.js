import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from '../helpers/battleHarness.js';
import { unitInfo } from '../../server/sim/snapshot.js';
import { renderInfo, summonerSkinForView } from '../../public/js/render/app/info.js';
import { spineEntry, hasBackSpine, createAssets } from '../../public/js/assets.js';
import { rewriteManifest } from '../../server/http/assetViews.js';
import { installFakePixi } from './fakepixi.js';

const TOKEN = 'token_10000_silent_healrb';
const SKIN_A = 'char_108_silent@winter#1';
const SKIN_B = 'char_108_silent@summer#1';
function scenario(skins = [null, null]) {
  const h = makeBattle({ content: 'none', units: [
    { chessId: 'chess_char_2_02_a', row: 10, col: 4, uid: 7 },
    { chessId: 'chess_char_2_02_a', row: 10, col: 5, uid: 8 },
  ] });
  h.step();
  const owners = [h.unit(7), h.unit(8)];
  owners.forEach((u,i) => { u.skin = skins[i]; });
  const tokens = owners.map((u,i) => h.b.spawnToken(u, TOKEN, 11, 4+i));
  assert.ok(tokens.every(Boolean));
  return { h, owners, tokens };
}

test('real token spawns carry their exact operator instance and skin through fieldMeta and renderInfo', () => {
  const {h,owners,tokens}=scenario([SKIN_A,SKIN_B]);
  assert.equal(owners[0].ownerId,owners[1].ownerId);
  assert.equal(owners[0].def.charId,owners[1].def.charId);
  const spawn = h.b.drainEvents().filter(e=>e[0]==='spawn').map(e=>e[1]);
  for(let i=0;i<2;i++) {
    const wire=spawn.find(u=>u.id===tokens[i].id);
    assert.equal(wire.summonerId,owners[i].id);
    assert.equal(wire.summonerSkin,[SKIN_A,SKIN_B][i]);
    assert.deepEqual(h.b.fieldMeta().units.find(u=>u.id===tokens[i].id),wire);
    const rendered=renderInfo(wire);
    assert.equal(rendered.summonerId,owners[i].id);
    assert.equal(rendered.summonerSpine,owners[i].def.spine??owners[i].def.charId);
    assert.equal(rendered.summonerSkin,[SKIN_A,SKIN_B][i]);
    assert.equal(unitInfo(owners[i]).summonerId,undefined);
  }
  h.b.retreat(owners[0],{permanent:true});
  const late=renderInfo(unitInfo(tokens[0]));
  assert.equal(late.summonerId,owners[0].id);
  assert.equal(late.summonerSkin,SKIN_A,'retreat keeps the actual summoner fallback');
});

test('nested token owners resolve the actual operator and malformed owner cycles terminate',()=>{
  const {h,owners,tokens}=scenario([SKIN_A,SKIN_B]);
  const nested=h.b.spawnToken(tokens[0],TOKEN,12,4,{anySource:true});
  assert.ok(nested);
  assert.equal(unitInfo(nested).summonerId,owners[0].id);
  assert.equal(unitInfo(nested).summonerSkin,SKIN_A);
  tokens[0].ownerUnit=tokens[0];
  assert.equal(unitInfo(tokens[0]).summonerId,undefined);
  owners[1].ownerUnit=tokens[1];
  assert.equal(unitInfo(tokens[1]).summonerId,owners[1].id);
});

test('other-skins visibility gates the fallback, live defaults win, and instances never share a character lookup',()=>{
  const wire=renderInfo({id:3,kind:'token',ownerId:'partner',summonerId:1,summonerSpine:'same-char',summonerSkin:SKIN_A});
  assert.equal(summonerSkinForView(wire,null,'me',false),null);
  assert.equal(summonerSkinForView(wire,null,'me',true),SKIN_A);
  assert.equal(summonerSkinForView(wire,null,'partner',false),SKIN_A);
  assert.equal(summonerSkinForView(wire,{id:1,kind:'op',skin:null},'me',true),null);
  assert.equal(summonerSkinForView(wire,{id:1,kind:'op',skin:SKIN_B},'me',true),SKIN_B);
  assert.equal(summonerSkinForView(wire,{id:2,kind:'op',skin:SKIN_B},'me',true),SKIN_A);
  wire.sourceSummonerSkin=SKIN_A;wire.summonerSkin=null;
  assert.equal(summonerSkinForView(wire,null,'me',true),SKIN_A,'preference can be turned on again');
  assert.equal(renderInfo({id:3,kind:'token',summonerId:NaN}).summonerId,undefined);
  assert.equal(renderInfo({id:3,kind:'enemy',summonerId:1,summonerSkin:SKIN_A}).summonerId,undefined);
});

test('summoner appearance metadata leaves compact snapshots and battle result numbers unchanged',()=>{
  const plain=scenario(), dressed=scenario([SKIN_A,SKIN_B]);
  assert.equal(unitInfo(plain.tokens[0]).summonerSkin,null);
  plain.h.run(1);dressed.h.run(1);
  assert.deepEqual(dressed.h.snapshot(),plain.h.snapshot());
  assert.deepEqual(dressed.h.result(),plain.h.result());
});

test('token model lookup uses the summoner skin and preserves default/missing-model fallback and Back models',()=>{
  const sp=name=>({skel:`/assets/local/${name}.skel`,atlas:`/assets/local/${name}.atlas`,textures:[`/assets/local/${name}.png`],anims:{idle:'Idle'}});
  const base=sp('default'),front=sp('outfit-front'),back=sp('outfit-back');
  const m={tokens:{[TOKEN]:{spine:base}}};
  const local={groups:{},tokenSkins:{[TOKEN]:{[SKIN_A]:{front,back},[SKIN_B]:{front:{}}}}};
  assert.equal(spineEntry(m,TOKEN,{local,summonerSkin:SKIN_A}),front);
  assert.equal(spineEntry(m,TOKEN,{local,summonerSkin:SKIN_A,back:true}),back);
  assert.equal(hasBackSpine(m,TOKEN,{local,summonerSkin:SKIN_A}),true);
  assert.equal(spineEntry(m,TOKEN,{local,summonerSkin:SKIN_B}),base);
  assert.equal(spineEntry(m,TOKEN,{local,summonerSkin:null}),base);
  assert.equal(spineEntry(m,TOKEN,{local}),base);
  const store=createAssets({manifest:m,localManifest:local});
  assert.equal(store.spineEntry(TOKEN,{summonerSkin:SKIN_A}),front);
  assert.equal(store.hasBack(TOKEN,{summonerSkin:SKIN_A}),true);
  const served=rewriteManifest(local,'local-assets.json',{hashOf:()=>null,modelHash:()=>null});
  assert.deepEqual(served.doc.tokenSkins,local.tokenSkins,'local HTTP view keeps both appearance keys');
});

test('production UnitView forwards the exact displayed summoner skin for token models',async()=>{
  const fake=installFakePixi();
  try {
    const {UnitView}=await import('../../public/js/render/units.js');
    const calls=[];
    const view={info:{kind:'token',spine:TOKEN,summonerSkin:SKIN_A},ctx:{assets:{spineEntry:(id,opts)=>{calls.push({id,opts});return {selected:true};}}}};
    assert.deepEqual(UnitView.prototype._modelEntry.call(view,true),{selected:true});
    assert.deepEqual(calls,[{id:TOKEN,opts:{back:true,summonerSkin:SKIN_A}}]);
    view.info.summonerSkin=null;
    UnitView.prototype._modelEntry.call(view,false);
    assert.deepEqual(calls[1],{id:TOKEN,opts:{back:false}});
  } finally {fake.restore();}
});
