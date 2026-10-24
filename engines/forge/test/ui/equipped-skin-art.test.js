import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portraitUrlOf, avatarUrlOf, selectedSkinEntry } from '../../public/js/ui/portraitChain.js';
import { skinSelectionFor } from '../../shared/skinForms.js';

const FRONT = { skel: '/model/front.skel' };
const BASE = { portrait: '/base/p.png', portraitE2: '/base/p2.png', avatar: '/base/a.png', avatarE2: '/base/a2.png' };
const SUMMER = { portrait: '/summer/p.png', avatar: '/summer/a.png', spine: { front: FRONT } };
const MANIFEST = { chars: {
  char_498_inside: { ...BASE, skins: { summer: SUMMER, art: { portrait: '/art/p.png' }, missing: { spine: { front: FRONT } } } },
  char_609_acguad: { ...BASE, skins: { winter: { ...SUMMER, portrait: '/sharp/p.png' } } },
  char_002_amiya: { ...BASE, skins: { 'char_1001_amiya2@casc#1': SUMMER, 'char_002_amiya@winter#1': SUMMER } },
  char_1001_amiya2: { ...BASE, skins: { 'char_1001_amiya2@casc#1': SUMMER } },
} };
const chess = (isGolden = false) => ({ charId: 'char_498_inside', isGolden, assets: { portrait: `char_498_inside_${isGolden ? 2 : 1}`, avatar: `char_498_inside_${isGolden ? 2 : 1}` } });

test('equipping an outfit changes normal and elite portraits AND avatars, even with explicit built-in art suffixes', () => {
  for (const elite of [false, true]) {
    assert.equal(portraitUrlOf(MANIFEST, chess(elite), { skinId: 'summer' }), '/summer/p.png');
    assert.equal(avatarUrlOf(MANIFEST, chess(elite), { skinId: 'summer' }), '/summer/a.png');
  }
  assert.equal(portraitUrlOf(MANIFEST, chess(), { skinId: 'summer', variant: 'elite' }), '/summer/p.png');
});

test('clearing, unknown, removed, model-less and image-less outfits preserve the normal/E2 fallback chain', () => {
  for (const skinId of [null, '', 'unknown', 'art', 'missing']) {
    assert.equal(portraitUrlOf(MANIFEST, chess(), { skinId }), BASE.portrait);
    assert.equal(portraitUrlOf(MANIFEST, chess(true), { skinId }), BASE.portraitE2);
    assert.equal(avatarUrlOf(MANIFEST, chess(true), { skinId }), BASE.avatarE2);
  }
});

test('art belongs to the effective stand-in / DIY operator, never the replaced slot or another operator', () => {
  assert.equal(selectedSkinEntry(MANIFEST, 'char_609_acguad', 'summer'), null);
  assert.equal(portraitUrlOf(MANIFEST, { charId: 'char_609_acguad' }, { skinId: 'summer' }), BASE.portrait);
  assert.equal(portraitUrlOf(MANIFEST, { charId: 'char_609_acguad' }, { skinId: 'winter' }), '/sharp/p.png');
  assert.equal(portraitUrlOf(MANIFEST, { charId: null }, { skinId: 'summer' }), null);
});

test('Amiya ascension outfits cannot leak onto the caster even in a legacy mixed manifest', () => {
  const legacy = { char_002_amiya: 'char_1001_amiya2@casc#1' };
  assert.equal(skinSelectionFor('char_002_amiya', legacy), null);
  assert.equal(skinSelectionFor('char_1001_amiya2', legacy), legacy.char_002_amiya);
  assert.equal(portraitUrlOf(MANIFEST, { charId: 'char_002_amiya' }, { skinId: legacy.char_002_amiya }), BASE.portrait);
  assert.equal(portraitUrlOf(MANIFEST, { charId: 'char_1001_amiya2_2' }, { skinId: legacy.char_002_amiya }), SUMMER.portrait);
});

test('all installed official outfits resolve their own portrait and avatar for both ordinary and elite cards', () => {
  const local = JSON.parse(readFileSync(new URL('../../data/local-assets.json', import.meta.url), 'utf8'));
  let count = 0;
  for (const [charId, rec] of Object.entries(local.chars || {})) {
    for (const [skinId, skin] of Object.entries(rec.skins || {})) {
      assert.ok(skin.portrait && skin.avatar && skin.illust && skin.spine?.front?.skel, `${charId} ${skinId} has complete art/model`);
      for (const isGolden of [false, true]) {
        const c = { charId, isGolden, assets: { portrait: `${charId}_${isGolden ? 2 : 1}`, avatar: `${charId}_${isGolden ? 2 : 1}` } };
        assert.equal(portraitUrlOf(local, c, { skinId }), skin.portraitE2 || skin.portrait);
        assert.equal(avatarUrlOf(local, c, { skinId }), skin.avatarE2 || skin.avatar);
      }
      count++;
    }
  }
  assert.equal(count, 303);
});

// The actual hook-driven OperatorImg is exercised in the root browser acceptance. These component vnodes verify that
// the non-hook selection/shop/stand-in/DIY views opt into the right source rather than accidentally opting every
// generic thumbnail (including another player's) into this browser's wardrobe.
globalThis.fetch = async (url) => {
  try { const body = readFileSync(new URL(`../../data/${String(url).split('/').pop()}`, import.meta.url), 'utf8'); return { ok: true, json: async () => JSON.parse(body) }; }
  catch { return { ok: false, status: 404, json: async () => ({}) }; }
};
const { data } = await import('../../public/js/data.js');
const { OperatorImg, UnitThumb } = await import('../../public/js/ui/gameComponents.js');
const { ChessCard } = await import('../../public/js/ui/shopBar.js');
const { OpCard, RosterRow } = await import('../../public/js/screens/loadout.js');
const { ChessDetail, resolveDetail } = await import('../../public/js/ui/detailPanel.js');
await data.loadAll('chess', 'assets', 'backups', 'garrisons', 'items', 'bonds', 'effects');
function* walk(v) {
  if (Array.isArray(v)) { for (const x of v) yield* walk(x); return; }
  if (!v || typeof v !== 'object') return;
  yield v;
  yield* walk(v.props?.children);
}
const images = (v) => [...walk(v)].filter((n) => n.type === OperatorImg);
const SILVER = 'chess_char_4_22_a';
const c = data.lookup('chess', SILVER);

test('selection card and list use reactive local portraits and avatars', () => {
  const p = { m: MANIFEST, chess: c, golden: data.lookup('chess', c.goldenId), entries: {} };
  assert.ok(images(OpCard(p)).some((n) => n.props.localSkins && n.props.chess.charId === c.charId && n.props.kind !== 'avatar'));
  assert.ok(images(RosterRow(p)).some((n) => n.props.localSkins && n.props.chess.charId === c.charId && n.props.kind === 'avatar'));
});

test('shop / reward artwork queries the effective operator after stand-in resolution', () => {
  const p = { slot: { id: SILVER, price: 3 }, idx: 0, priv: { standIns: [SILVER], hand: [], board: [], temp: [] }, onBuy() {}, onDetail() {} };
  const image = images(ChessCard(p))[0];
  assert.equal(image.props.chess.charId, 'char_609_acguad');
  assert.equal(image.props.localSkins, true);
  const ownImage = images(ChessCard({ ...p, priv: { ...p.priv, standIns: [] } }))[0];
  assert.equal(ownImage.props.chess.charId, c.charId);
});

test('foreign unit details retain the unit skin; generic thumbnails never assume a local wardrobe', () => {
  const resolved = resolveDetail({ kind: 'unit', unit: { id: 9, uid: 41, side: 'ally', defId: SILVER, ownerId: 'peer', skin: 'peer-skin' } },
    new Map([[41, { piece: { uid: 41, id: SILVER, kind: 'chess' } }]]), { priv: { playerId: 'self', standIns: [SILVER] } });
  assert.equal(resolved.foreign, true);
  assert.equal(resolved.skin, 'peer-skin');
  assert.equal(resolved.piece, null, 'another player can reuse our uid without becoming our piece');
  assert.equal(resolved.standIn, null, 'the viewer\'s stand-in preference does not replace the peer body');
  const image = images(ChessDetail({ chess: c, bonds: [], localSkins: !resolved.foreign, skinId: resolved.skin }))[0];
  assert.equal(image.props.localSkins, false);
  assert.equal(image.props.skinId, 'peer-skin');
  const generic = images(UnitThumb({ id: SILVER }))[0];
  assert.equal(generic.props.localSkins, false);
});
