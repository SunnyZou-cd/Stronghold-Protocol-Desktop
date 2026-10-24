import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadData } from '../server/data.js';
import { buildWorkshopDataFiles } from '../server/http/workshop.js';

test('local operator wardrobes survive the workshop data response without replacing base models', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-local-wardrobe-'));
  try {
    const id = 'char_102_texas';
    const base = { chars: { [id]: { avatar: '/assets/default.png', spine: { front: { skel: '/assets/default.skel' } } } } };
    const local = { chars: { [id]: { avatar: '/assets/local.png', skins: { 'char_102_texas@epoque#7': { spine: { front: { skel: '/assets/official-outfits/texas.skel' } } } } } } };
    fs.writeFileSync(path.join(dir, 'assets.json'), JSON.stringify(base));
    fs.writeFileSync(path.join(dir, 'local-assets.json'), JSON.stringify(local));
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ economy: { desktopAlliances: [] } }));
    const data = loadData(dir, { expected: [], workshopDir: null, log: { warn() {}, error() {} } });
    const files = buildWorkshopDataFiles(data, { packs: [{ id: 'wardrobe-fixture' }] });
    const served = JSON.parse(files.get('assets'));
    assert.equal(served.chars[id].avatar, '/assets/default.png');
    assert.equal(served.chars[id].spine.front.skel, '/assets/default.skel');
    assert.equal(served.chars[id].skins['char_102_texas@epoque#7'].spine.front.skel, '/assets/official-outfits/texas.skel');
    assert.ok(Object.isFrozen(data.assets.chars[id].skins));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'assets.json'))), base);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
