import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDataStore } from '../public/js/data.js';
import { createRoomDataSync } from '../public/js/mods/roomData.js';
import * as roomMods from '../public/js/roomMods.js';

test('room data drives both lookup and get; gameplay content drops back to the selected room', async () => {
  const data = createDataStore({ fetch: async () => ({ ok: true, json: async () => ({ extra: { name: 'all' } }) }) });
  await data.load('chess');
  const sync = createRoomDataSync({ data, files: ['chess'], fetch: async () => ({ ok: true, json: async () => ({ base: { name: 'base' } }) }), onError: assert.fail });
  await sync({ digest: 'a'.repeat(64), packs: [] }, { digest: 'b'.repeat(64) });
  assert.equal(data.lookup('chess', 'extra'), null);
  assert.equal(data.lookup('chess', 'base').name, 'base');
  data.setContent({ id: 'gameplay', values: { chess: { plugin: { name: 'plugin' } } } });
  assert.ok(data.lookup('chess', 'plugin'));
  data.setContent(null);
  assert.ok(data.lookup('chess', 'base'));
  assert.equal(data.lookup('chess', 'plugin'), null);
  await sync(null, null);
  assert.ok(data.lookup('chess', 'extra'));
  assert.equal(data.lookup('chess', 'base'), null);
});

test('a slow previous room cannot overwrite the latest room selection', async () => {
  const data = createDataStore(); let finishOld;
  const sync = createRoomDataSync({ data, files: ['bonds'], onError: assert.fail, fetch: async url => {
    if (url.includes('a'.repeat(64))) await new Promise(r => { finishOld = r; });
    return { ok: true, json: async () => ({ current: url }) };
  } });
  const old = sync({ digest: 'a'.repeat(64) });
  await sync({ digest: 'c'.repeat(64) });
  finishOld(); await old;
  assert.match(data.get('bonds').current, new RegExp('c'.repeat(64)));
});

test('a saved empty selection stays empty after reconnect; native faction choices are remembered separately', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  } });
  const welcome = { mods: { digest: 'd'.repeat(64), packs: ['lele-rhine', 'lele-kazdel'].map(id => ({ id })) } };
  try {
    roomMods.reset(); roomMods.setWelcomeMods(welcome);
    assert.deepEqual(roomMods.getSelectedModIds(), ['lele-kazdel', 'lele-rhine']);
    roomMods.setSelectedModIds([]); roomMods.reset(); roomMods.setWelcomeMods(welcome);
    assert.deepEqual(roomMods.getSelectedModIds(), []);
    assert.deepEqual(roomMods.buildCreatePayload('solo', 'FUNNY').modIds, []);
    roomMods.setSelectedModIds(['lele-kazdel']); roomMods.reset(); roomMods.setWelcomeMods(welcome);
    assert.deepEqual(roomMods.getSelectedModIds(), ['lele-kazdel']);
  } finally { roomMods.reset(); if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; }
});
