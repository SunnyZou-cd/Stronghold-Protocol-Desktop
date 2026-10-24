import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { AMIYA_BODY_IDS, skinFormCharId, skinBodyCharId, isSkinForForm, skinSelectionFor } from '../shared/skinForms.js';
import { officialSkinBody, remapOfficialSkinBodies } from '../tools/assets/skin-forms.mjs';
import { avatarUrl, portraitUrl, illustUrl, spineEntry, skinsOf, hasBackSpine } from '../public/js/assets.js';
import { data } from '../public/js/data.js';
import { availableSkins, chosenSkin, skinFor, setSkin, setSkins, clearSkin, parseStoredSkins, skinsStore, SKINS_KEY } from '../public/js/ui/skins.js';
import { PlayerBasics } from '../server/match/player/basics.js';
import { checkSkinSelection } from '../shared/protocol.js';
import { createStore } from '../public/js/store.js';
import { installSkinsSync } from '../public/js/ui/loadoutSync.js';

const [CASTER, GUARD, MEDIC] = AMIYA_BODY_IDS;
const KEYS = [CASTER + '@winter#1', GUARD + '@sale#16', MEDIC + '@sale#13'];
const skeleton = name => ({ skel: `/s/${name}.skel`, atlas: `/s/${name}.atlas`, anims: { idle: 'Idle' } });
const skin = (name, back = true) => ({ name, avatar: `/a/${name}.png`, portrait: `/p/${name}.png`, illust: `/i/${name}.png`,
  spine: { front: skeleton(name), ...(back ? { back: skeleton(name + '-back') } : {}) } });
// Deliberately misgroup every form under every body: all entry points must defend against a stale plugin overlay.
const mixed = { chars: Object.fromEntries(AMIYA_BODY_IDS.map((id, i) => [id, {
  avatar: `/a/${i}.png`, avatarE2: `/a/${i}-e2.png`, portrait: `/p/${i}.png`, portraitE2: `/p/${i}-e2.png`, illust: `/i/${i}.png`,
  spine: { front: skeleton(String(i)) }, skins: Object.fromEntries(KEYS.map((key, j) => [key, skin('skin' + j)])),
}])) };
after(() => { data.setContent(null); setSkins({}); });

test('official tmplId, rather than shared charId, is the wardrobe body key', () => {
  const patch = { infos: { [CASTER]: { tmplIds: AMIYA_BODY_IDS } } };
  const table = { charSkins: Object.fromEntries(KEYS.map((id, i) => [id, { skinId: id, charId: CASTER, tmplId: AMIYA_BODY_IDS[i] }])) };
  for (let i = 0; i < KEYS.length; i++) assert.equal(officialSkinBody(table.charSkins[KEYS[i]], patch), AMIYA_BODY_IDS[i]);
  const input = { groups: { untouched: {} }, chars: { [CASTER]: { avatar: '/a/base.png', skins: Object.fromEntries(KEYS.map((key, i) => [key, skin('skin' + i)])) } } };
  const result = remapOfficialSkinBodies(input, table, patch);
  assert.equal(result.moves.length, 2);
  assert.deepEqual(result.manifest.groups, input.groups);
  assert.equal(result.manifest.chars[CASTER].avatar, '/a/base.png');
  for (let i = 0; i < KEYS.length; i++) assert.deepEqual(result.manifest.chars[AMIYA_BODY_IDS[i]].skins[KEYS[i]], input.chars[CASTER].skins[KEYS[i]]);
  assert.deepEqual(remapOfficialSkinBodies(result.manifest, table, patch), { manifest: result.manifest, moves: [] });
  assert.throws(() => officialSkinBody({ charId: CASTER, skinId: 'x', tmplId: 'char_999_notamiya' }, patch), /Unrecognised template/);
});

test('normal and E2 use the same body, while official outfit body prefixes stay distinct', () => {
  for (let i = 0; i < KEYS.length; i++) {
    assert.equal(skinFormCharId(AMIYA_BODY_IDS[i] + '_2'), AMIYA_BODY_IDS[i]);
    assert.equal(skinBodyCharId(KEYS[i]), AMIYA_BODY_IDS[i]);
    for (let j = 0; j < KEYS.length; j++) assert.equal(isSkinForForm(AMIYA_BODY_IDS[i] + '_2', KEYS[j]), i === j);
  }
  assert.equal(isSkinForForm(CASTER, 'custom_plugin_outfit'), true, 'unrelated plugin naming is retained');
});

test('avatar, portrait, illustration, Spine and Back detection all reject cross-body official skins', () => {
  for (let i = 0; i < KEYS.length; i++) {
    const id = AMIYA_BODY_IDS[i] + '_2';
    assert.deepEqual(Object.keys(skinsOf(mixed, AMIYA_BODY_IDS[i])), [KEYS[i]]);
    for (let j = 0; j < KEYS.length; j++) {
      assert.equal(avatarUrl(mixed, id, { skin: KEYS[j] }), i === j ? `/a/skin${j}.png` : `/a/${i}-e2.png`);
      assert.equal(portraitUrl(mixed, id, { skin: KEYS[j] }), i === j ? `/p/skin${j}.png` : `/p/${i}-e2.png`);
      assert.equal(illustUrl(mixed, id, { skin: KEYS[j] }), i === j ? `/i/skin${j}.png` : `/i/${i}.png`);
      assert.equal(spineEntry(mixed, id, { skin: KEYS[j] }).skel, i === j ? `/s/skin${j}.skel` : `/s/${i}.skel`);
      assert.equal(hasBackSpine(mixed, id, KEYS[j]), i === j);
    }
  }
});

test('a valid form skin missing its art falls back to that body and its E2 art', () => {
  const noArt = structuredClone(mixed);
  noArt.chars[GUARD].skins[KEYS[1]] = { spine: { front: skeleton('guard-outfit') } };
  assert.equal(avatarUrl(noArt, GUARD + '_2', { skin: KEYS[1] }), '/a/1-e2.png');
  assert.equal(portraitUrl(noArt, GUARD + '_2', { skin: KEYS[1] }), '/p/1-e2.png');
  assert.equal(illustUrl(noArt, GUARD, { skin: KEYS[1] }), '/i/1.png');
});

test('picker rows, stored selection, legacy recovery and clear agree on cosmetic body', () => {
  data.setContent({ id: 'f'.repeat(64), values: { assets: mixed } });
  for (let i = 0; i < KEYS.length; i++) assert.deepEqual(availableSkins(AMIYA_BODY_IDS[i]).map(r => r.id), ['', KEYS[i]]);
  const legacy = { [CASTER]: KEYS[1] };
  assert.equal(skinSelectionFor(CASTER, legacy), null);
  assert.equal(skinSelectionFor(GUARD, legacy), KEYS[1]);
  assert.equal(skinSelectionFor(MEDIC, legacy), null);
  setSkins(legacy);
  assert.deepEqual(skinsStore.get()[SKINS_KEY], { [GUARD]: KEYS[1] }, 'the store and the next room.skins payload use the actual body');
  assert.deepEqual(checkSkinSelection(skinsStore.get()[SKINS_KEY]), { ok: true, skins: { [GUARD]: KEYS[1] }, dropped: 0 });
  assert.equal(chosenSkin(CASTER), null);
  assert.equal(chosenSkin(GUARD), KEYS[1]);
  assert.equal(skinFor(CASTER), null);
  clearSkin(GUARD);
  assert.equal(chosenSkin(GUARD), null, 'default clears a recovered legacy choice');
  setSkin(CASTER, KEYS[1]);
  assert.equal(chosenSkin(CASTER), null, 'wrong-body setter is ignored');
  setSkin(CASTER + '_2', KEYS[0]);
  assert.equal(chosenSkin(CASTER), KEYS[0], 'ordinary and elite share the caster choice');
  clearSkin(CASTER + '_2');
  assert.equal(chosenSkin(CASTER), null);
});

test('legacy body-key migration preserves an explicit form choice regardless of insertion order', () => {
  const otherGuard = GUARD + '@casc#1';
  for (const entries of [{ [CASTER]: KEYS[1], [GUARD]: otherGuard }, { [GUARD]: otherGuard, [CASTER]: KEYS[1] }]) {
    assert.deepEqual(parseStoredSkins(entries), { [GUARD]: otherGuard });
  }
  const migrated = parseStoredSkins({ [CASTER]: KEYS[2] });
  assert.deepEqual(migrated, { [MEDIC]: KEYS[2] });
  assert.equal(PlayerBasics.prototype.skinFor.call({ skins: checkSkinSelection(migrated).skins, skinCharIdOf: rec => rec.charId }, { charId: MEDIC }), KEYS[2]);
});

test('sync prepares a legacy selection under its actual body and the server recovers exactly that form', async () => {
  const target = createStore({ [SKINS_KEY]: { [CASTER]: KEYS[1] }, skinsSync: 'idle' });
  let payload;
  const net = { status: 'online', on: () => () => {}, request: async (type, body) => {
    assert.equal(type, 'room.skins');
    payload = body.skins;
    return { t: 'ok' };
  } };
  const sync = installSkinsSync({ net, target });
  try { await sync.flush(); } finally { sync.dispose(); }
  assert.deepEqual(payload, { [GUARD]: KEYS[1] });
  const accepted = checkSkinSelection(payload, id => AMIYA_BODY_IDS.includes(id));
  assert.equal(accepted.dropped, 0);
  const ps = { skins: accepted.skins, skinCharIdOf: rec => rec.charId };
  assert.equal(PlayerBasics.prototype.skinFor.call(ps, { charId: GUARD }), KEYS[1]);
  assert.equal(PlayerBasics.prototype.skinFor.call(ps, { charId: CASTER }), null);
  assert.equal(PlayerBasics.prototype.skinFor.call(ps, { charId: MEDIC }), null);
});

test('server effective-body resolution rejects legacy wrong-form choices before shop, scout or battle output', () => {
  assert.deepEqual(checkSkinSelection({ [CASTER]: KEYS[1], [GUARD]: KEYS[1], [MEDIC]: KEYS[0] }),
    { ok: true, skins: { [GUARD]: KEYS[1] }, dropped: 2 }, 'lobby / match semantic validation drops cross-form pairs');
  const ps = { skins: { [CASTER]: KEYS[1] }, skinCharIdOf: rec => rec.charId };
  const read = (rec, body) => PlayerBasics.prototype.skinFor.call(ps, rec, body);
  assert.equal(read({ charId: CASTER }), null);
  assert.equal(read({ charId: CASTER }, MEDIC), null);
  assert.equal(read({ charId: GUARD }), KEYS[1]);
  assert.equal(read({ charId: null }, GUARD), KEYS[1], 'DIY uses the picked body');
  ps.skins = { [CASTER]: KEYS[0], [GUARD]: KEYS[1], [MEDIC]: KEYS[2] };
  for (let i = 0; i < KEYS.length; i++) assert.equal(read({ charId: AMIYA_BODY_IDS[i] }), KEYS[i]);
});
