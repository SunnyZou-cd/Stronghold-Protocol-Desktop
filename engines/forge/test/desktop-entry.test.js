import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoAlignDesktop } from '../public/js/mods/desktopAlignment.js';
import { META_API } from '../server/match/metaPack.js';
import { buildRoomRegistry } from '../server/match/metaPack.js';
import { getDefaultRegistry } from '../server/match/effectsMeta.js';
import { loadWorkshop } from '../server/workshop.js';
import { loadMetaModules } from '../server/match/metaPack.js';
import { makeMatch } from './match/harness.js';

test('desktop prepares missing local pack bytes, but keeps remote browsers, unknown packs and verified rooms manual', () => {
  const plan = { needed: true, ok: false, unknown: [] };
  const desktop = { userAgent: 'Mozilla/5.0 Electron/45.0.0', hostname: '127.0.0.1' };
  assert.equal(shouldAutoAlignDesktop(plan, desktop), true);
  assert.equal(shouldAutoAlignDesktop({ ...plan, ok: true }, desktop), false);
  assert.equal(shouldAutoAlignDesktop({ ...plan, unknown: ['missing'] }, desktop), false);
  assert.equal(shouldAutoAlignDesktop(plan, { ...desktop, hostname: 'example.com' }), false);
  assert.equal(shouldAutoAlignDesktop(plan, { ...desktop, userAgent: 'Chrome/145' }), false);
  assert.equal(shouldAutoAlignDesktop(null, desktop), false);
});

test('Ave Mujica preparation handler executes through the pack API and adds layers to active bonds', async () => {
  assert.equal(typeof META_API.bondOrder, 'function');
  const modules = await loadMetaModules(loadWorkshop());
  assert.deepEqual(modules.errors, []);
  const built = buildRoomRegistry({ packs: modules.modules, base: getDefaultRegistry() });
  assert.deepEqual(built.errors, []);
  const h = makeMatch({ mode: 'solo', registry: built.registry, seed: 811, fake: true });
  try {
    h.start(); h.toPrep();
    const ps = h.ps('p_0');
    ps.bondCountBonus.aveMujica = 2; ps.recompute();
    assert.equal(ps.bonds.aveMujica.active, true);
    const before = ps.layers.aveMujica || 0;
    h.m.dispatch(ps, 'onPrepEnd', {});
    assert.ok(ps.layers.aveMujica > before);
    assert.deepEqual(h.logs.error, []);
  } finally { h.m.dispose(); }
});
