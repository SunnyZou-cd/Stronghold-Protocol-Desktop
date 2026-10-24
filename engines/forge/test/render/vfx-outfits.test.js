import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OutfitIndex } from '../../public/js/render/vfx/outfits.js';
import { FxLibrary } from '../../public/js/render/vfx/library.js';
import { FxWiring } from '../../public/js/render/vfx/wiring.js';
import { planFor } from '../../public/js/render/vfx/skills.js';

function fixture() {
  const unit = { kind: 'char', skin: 'char_1_test', refs: ['cast', 'trail', 'hit'], projectiles: ['arrow'],
    modes: [{ name: 'Default', attack: { class: 'RangedAttack', projectileKey: 'arrow', cast: [{ effects: ['cast'] }] } }],
    skills: { skchr_test_1: { effects: ['cast'], uses: [{ from: 'Skill._beginEffect', role: 'start', keys: ['cast'] }],
      abilities: [], projectiles: ['arrow'], mode: null, rootClass: 'Skill' } } };
  const mounts = { points: { Muzzle: { front: { pos: [1, 0, 1], bone: 'F_Muzzle' } } } };
  const index = { version: 3, units: { char_1_test: unit }, skins: { char_1_test: {} }, skills: {},
    generic: {}, projectiles: { arrow: { main: 'trail', onHit: ['hit'], effects: ['trail', 'hit'] },
      graphic: { main: 'newtrail', onHit: ['hit'], effects: ['newtrail', 'hit'] } },
    prefabs: Object.fromEntries(['cast', 'trail', 'hit', 'redcast', 'redtrail', 'redhit', 'bluecast', 'newtrail', 'nested'].map(k => [k, { refs: k === 'redcast' ? ['hit'] : [] }])),
    outfits: { red: { charId: 'char_1_test', mounts, replacements: { cast: 'redcast', trail: 'redtrail', hit: 'redhit' } },
      blue: { charId: 'char_1_test', mounts, replacements: { cast: 'bluecast' },
        fakeProjectiles: [{ originProjectileKey: 'arrow', graphicProjectileKey: 'graphic', _fakeMuzzlePoint: 6 }] },
      shared: { charId: 'char_1_test', mounts, replacements: {} },
      missing: { charId: 'char_1_test', mounts, replacements: { cast: 'unavailable' } } } };
  return { index, unit };
}

test('outfit plans isolate simultaneous default/red/blue wearers and rewrite attacks, skills, projectiles and nested effects', () => {
  const { index, unit } = fixture(), original = structuredClone(unit);
  const lib = { outfitAliases: new Map() }, outfits = new OutfitIndex(index, lib);
  const red = outfits.of('char_1_test', 'red'), blue = outfits.of('char_1_test', 'blue');
  const r = red.units.char_1_test, b = blue.units.char_1_test;
  assert.deepEqual(unit, original);
  assert.equal(lib.outfitAliases.get(r.modes[0].attack.cast[0].effects[0]).source, 'redcast');
  assert.equal(lib.outfitAliases.get(b.modes[0].attack.cast[0].effects[0]).source, 'bluecast');
  assert.equal(lib.outfitAliases.get(red.projectiles[r.projectiles[0]].main).source, 'redtrail');
  assert.equal(lib.outfitAliases.get(blue.projectiles[b.projectiles[0]].main).source, 'newtrail');
  assert.equal(lib.outfitAliases.get(red.prefabs[r.refs[0]].refs[0]).source, 'redhit');
  assert.equal(outfits.of('char_1_test', 'red'), red);
  assert.equal(outfits.of('char_1_test', null), index);
  assert.equal(outfits.of('char_9_other', 'red'), index);
  const plan = planFor(red, { unitKey: 'char_1_test', info: { skillIndex: 0 }, rec: { fx: { unit: 'char_1_test' }, skill: { prefabId: 'skchr_test_1', index: 0, skillType: 'manual' } } });
  assert.equal(plan.unitKey, 'char_1_test');
  assert.equal(lib.outfitAliases.get(plan.plan.start[0].key).source, 'redcast');
});

test('missing replacement resources and verified shared-effect outfits retain actual original effects', () => {
  const { index } = fixture(), lib = { outfitAliases: new Map() }, outfits = new OutfitIndex(index, lib);
  for (const skin of ['missing', 'shared']) {
    const u = outfits.of('char_1_test', skin).units.char_1_test;
    assert.equal(lib.outfitAliases.get(u.refs[0]).source, 'cast');
  }
});

test('FxLibrary resolves outfit descriptors lazily and rewrites child effect references without fetching alias URLs', async () => {
  const { index } = fixture(), calls = [];
  const list = { groups: { fx: { index: { path: '/index' } }, 'fx/prefabs': Object.fromEntries(Object.keys(index.prefabs).map(k => [k, { path: '/' + k }])) } };
  const lib = new FxLibrary({ list, fetch: async url => {
    calls.push(url);
    return { ok: true, json: async () => url === '/index' ? index : { key: url.slice(1), refs: ['hit'], nodes: [{ onPlay: ['hit'] }] } };
  } });
  await lib.index();
  const red = lib.outfits.of('char_1_test', 'red'), key = red.units.char_1_test.refs[0];
  assert.equal(lib.has(key), true);
  const descriptor = await lib.descriptor(key);
  assert.equal(descriptor.key, key);
  assert.equal(lib.outfitAliases.get(descriptor.nodes[0].onPlay[0]).source, 'redhit');
  assert.deepEqual(calls, ['/index', '/redcast']);
});

test('default → A → B → default invalidates all wearer plan caches and stops held loops; sourceSkin cannot override hidden skin', () => {
  const { index } = fixture(), lib = { outfitAliases: new Map(), preload: async () => {} };
  lib.outfits = new OutfitIndex(index, lib);
  const w = new FxWiring({ lib, active: false }), stopped = [];
  w.idx = index; w.keysFor = () => [];
  w.release = v => stopped.push(v.info.skin || 'default');
  const v = { id: 1, info: { id: 1, spine: 'char_1_test', sourceSkin: 'red' } };
  assert.equal(w.unitOf(v), index.units.char_1_test);
  for (const skin of ['red', 'blue', undefined]) {
    for (const layer of [w.skills, w.talents, w.funnels]) layer.units.set(1, { stale: true });
    v.info.skin = skin;
    w.unitOf(v);
    for (const layer of [w.skills, w.talents, w.funnels]) assert.equal(layer.units.has(1), false);
  }
  assert.deepEqual(stopped, ['red', 'blue', 'default']);
  assert.equal(w.unitOf(v), index.units.char_1_test);
});

test('tokens consume the exact summoner appearance and token skin prefab mounts, including default and view-less hidden fallback', () => {
  const { index } = fixture();
  index.units.token_1 = { kind: 'token', refs: ['hit'], modes: [{ name: 'Default', attack: { cast: [{ effects: ['hit'] }] } }] };
  index.outfits.red.tokenUnits = { token_1: 'token_1' };
  index.outfits.red.tokenLooks = { token_1: { variant: 'token_1_red', mounts: { points: { Muzzle: { front: { pos: [2, 0, 2] } } } }, replacements: { hit: 'redhit' } } };
  const lib = { outfitAliases: new Map(), preload: async () => {}, has: () => true };
  lib.outfits = new OutfitIndex(index, lib);
  const owner = { id: 7, info: { id: 7, spine: 'char_1_test', skin: 'red' } };
  let live = owner;
  const w = new FxWiring({ lib, active: false }, { view: id => id === 7 ? live : null });
  w.idx = index;
  const token = { id: 9, info: { id: 9, spine: 'token_1', summonerId: 7, summonerSkin: 'blue' } };
  let u = w.unitOf(token);
  assert.equal(lib.outfitAliases.get(u.refs[0]).source, 'redhit');
  assert.deepEqual(w.skinOf(u).points.Muzzle.front.pos, [2, 0, 2]);
  owner.info.skin = null;
  assert.equal(w.unitOf(token), index.units.token_1, 'a live owner displaying default wins over a stale fallback');
  live = null; token.info.summonerSkin = null;
  assert.equal(w.unitOf(token), index.units.token_1);
  token.info.summonerSkin = 'red';
  assert.equal(lib.outfitAliases.get(w.unitOf(token).refs[0]).source, 'redhit');
});

test('a generic melee hit uses the attacker replacement, never the target skin', () => {
  const { index } = fixture();
  index.generic.hit = { phys: 'cast' };
  const lib = { outfitAliases: new Map(), preload: async () => {}, has: () => true };
  lib.outfits = new OutfitIndex(index, lib);
  const w = new FxWiring({ lib, active: true });
  w.idx = index;
  const src = { id: 1, info: { id: 1, spine: 'char_1_test', skin: 'red' } };
  const target = { id: 2, info: { id: 2, spine: 'char_1_test', skin: 'blue' } };
  const keys = [];
  w.playOn = key => { keys.push(key); return {}; };
  w._landed({ hits: [], n: 0, src }, target, 0, 'phys');
  assert.equal(lib.outfitAliases.get(keys[0]).source, 'redcast');
});

test('legacy/minimal indexes without skins, projectiles or prefab dictionaries fall back safely', () => {
  const index = { units: { char_1_test: { kind: 'char' } } };
  assert.equal(new OutfitIndex(index, { outfitAliases: new Map() }).of('char_1_test', 'unknown'), index);
});

test('inline white textures decode through img-src without a CSP-blocked fetch; local files retain the flipped bitmap path', async () => {
  const oldImage = globalThis.Image, oldBitmap = globalThis.createImageBitmap;
  const fetched = [], decoded = [];
  class TestImage {
    set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
  }
  globalThis.Image = TestImage;
  globalThis.createImageBitmap = async (blob, opts) => { decoded.push({ blob, opts }); return { bitmap: true }; };
  try {
    const lib = new FxLibrary({ fetch: async url => { fetched.push(url); return { ok: true, blob: async () => 'file-blob' }; } });
    const inline = await lib._image('data:image/png;base64,iVBORw0KGgo=');
    assert.ok(inline.image instanceof TestImage);
    assert.equal(inline.flipped, false);
    assert.deepEqual(fetched, []);
    assert.deepEqual(decoded, []);
    const local = await lib._image('/assets/local/fx/tex/white.webp');
    assert.equal(local.flipped, true);
    assert.deepEqual(fetched, ['/assets/local/fx/tex/white.webp']);
    assert.equal(decoded[0].opts.imageOrientation, 'flipY');
  } finally {
    if (oldImage === undefined) delete globalThis.Image; else globalThis.Image = oldImage;
    if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap;
  }
});
