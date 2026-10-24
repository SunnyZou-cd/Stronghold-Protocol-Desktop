import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSpineData } from '../../public/js/assets.js';

test('Spine textures skip Pixi worker data-URL probing without disabling bitmap decoding', async () => {
  const previous = globalThis.PIXI, calls = [];
  const data = { animations: [] };
  try {
    globalThis.PIXI = { spine: {}, Assets: {
      setPreferences(prefs) { calls.push(prefs); },
      async load(url) { assert.deepEqual(calls, [{ preferWorkers: false }]); assert.equal(url, '/assets/unit.skel'); return { spineData: data }; },
    } };
    assert.equal(await loadSpineData({ skel: '/assets/unit.skel' }), data);
  } finally { globalThis.PIXI = previous; }
});
