// Execute the production renderer's cosmetic closures with data-only views: no canvas, browser or GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderInfo, summonerSkinForView } from '../../public/js/render/app/info.js';

const source = readFileSync(new URL('../../public/js/render/app.js', import.meta.url), 'utf8');
const OP = 'char_498_inside', SKIN = `${OP}@kitchen#2`;
const bodyOf = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  return start < 0 ? '' : source.slice(start, source.indexOf('\n  }', start) + 4);
};

function fixture() {
  const start = source.indexOf('  const skinOf = ');
  const end = source.indexOf('\n\n', source.indexOf('  const shownSkin = ', start));
  const s = source.indexOf('    setSettings(s) {');
  const settingsMethod = source.slice(s, source.indexOf('\n    },', s) + 6).trim();
  const infos = new Map(), views = new Map(), dropped = [];
  const ctx = { myPlayerId: 'p_0' }, settings = { otherSkins: true, quality: 'high' };
  class UnitView {
    constructor(_ctx, info) { this.info = info; }
    setWorld() {}
    setDir() {}
  }
  const factory = new Function('renderInfo', 'ctx', 'settings', 'infos', 'views', 'dropView', 'UnitView', 'summonerSkinForView', `
    let mode = 'battle', lastPrep = null;
    const board3d = null;
    function resize() {} function syncOfficialFx() {} function heightAt() { return 0; }
    function setPrep() { syncReadOnlyPrepUnits(lastPrep.units); }
    ${source.slice(start, end)}
    ${['applyInfo', 'refreshSkins', 'refreshSummonerSkins', 'setMe', 'setSkins', 'syncReadOnlyPrepUnits'].map(bodyOf).join('\n')}
    return { applyInfo, setMe, setSkins: typeof setSkins === 'function' ? setSkins : undefined,
      ${settingsMethod},
      readOnly(units) { mode = 'prep'; lastPrep = { units }; setPrep(); }
    };`);
  const api = factory(renderInfo, ctx, settings, infos, views, (id) => { dropped.push(id); views.delete(id); }, UnitView, summonerSkinForView);
  return { api, infos, views, dropped };
}
const unit = (id, ownerId = 'p_1', skin = SKIN) => ({ id, uid: id, kind: 'op', side: 'ally', ownerId, skin, spine: OP });

test('token views follow their exact summoner, preference changes, live choices and a view-less fallback', () => {
  const { api, infos, views, dropped } = fixture();
  const another = `${OP}@winter#1`;
  const token = (id, summonerId, skin) => ({ id, kind: 'token', side: 'ally', ownerId: 'p_1',
    spine: 'token_test', summonerId, summonerSpine: OP, summonerSkin: skin });
  api.applyInfo(unit(1)); api.applyInfo(unit(3, 'p_1', another));
  api.applyInfo(token(2, 1, SKIN)); api.applyInfo(token(4, 3, another));
  assert.equal(infos.get(2).summonerSkin, SKIN);
  assert.equal(infos.get(4).summonerSkin, another, 'same player/character does not select the other instance');
  api.setSettings({ otherSkins: false });
  assert.equal(infos.get(2).summonerSkin, null);
  assert.equal(infos.get(4).summonerSkin, null);
  assert.ok(dropped.includes(2) && dropped.includes(4));
  api.setSettings({ otherSkins: true });
  assert.equal(infos.get(2).summonerSkin, SKIN);
  assert.equal(infos.get(4).summonerSkin, another);
  views.delete(1);
  api.setSkins([{ playerId: 'p_1', skins: { [OP]: another } }]);
  assert.equal(infos.get(2).summonerSkin, another, 'retreated view keeps its updated operator info');
  api.applyInfo(token(5, 999, SKIN));
  api.setSettings({ otherSkins: false });
  assert.equal(infos.get(5).summonerSkin, null, 'missing-owner fallback obeys the setting');
  api.setSettings({ otherSkins: true });
  assert.equal(infos.get(5).summonerSkin, SKIN);
});

test('on → off → on restores loaded skins, including units first received while hidden', () => {
  const { api, infos, dropped } = fixture();
  api.applyInfo(unit(1));
  api.applyInfo(unit(2, 'p_0'));
  api.setSettings({ otherSkins: false });
  api.applyInfo(unit(3));
  assert.equal(infos.get(1).skin, null);
  assert.equal(infos.get(2).skin, SKIN);
  api.setSettings({ otherSkins: true });
  assert.equal(infos.get(1).skin, SKIN);
  assert.equal(infos.get(3).skin, SKIN);
  assert.deepEqual(dropped, [1, 1, 3]);
});

test('public choices update a running battle, clear it, and override later stale spawn metadata', () => {
  const { api, infos } = fixture();
  api.applyInfo(unit(1));
  const changed = `${OP}@changed#1`;
  assert.equal(typeof api.setSkins, 'function');
  api.setSkins([{ playerId: 'p_1', skins: { [OP]: changed } }]);
  assert.equal(infos.get(1).skin, changed);
  api.applyInfo(unit(1));
  assert.equal(infos.get(1).skin, changed, 'a battle started with an older choice');
  api.setSettings({ otherSkins: false });
  api.setSkins([{ playerId: 'p_1', skins: { [OP]: SKIN } }]);
  assert.equal(infos.get(1).skin, null);
  api.setSettings({ otherSkins: true });
  assert.equal(infos.get(1).skin, SKIN);
  api.setSkins([{ playerId: 'p_1' }]);
  api.applyInfo(unit(1));
  assert.equal(infos.get(1).skin, null, 'an omitted map clears a choice even over old battle metadata');
});

test('boss partner views refresh immediately when the setting or local identity changes', () => {
  const { api, views } = fixture();
  api.readOnly([unit(1)]);
  assert.equal(views.get('m:1').info.skin, SKIN);
  api.setSettings({ otherSkins: false });
  assert.equal(views.get('m:1').info.skin, null);
  api.setMe('p_1');
  assert.equal(views.get('m:1').info.skin, SKIN);
  api.setMe('p_0');
  assert.equal(views.get('m:1').info.skin, null);
  api.setSettings({ otherSkins: true });
  assert.equal(views.get('m:1').info.skin, SKIN);
});
