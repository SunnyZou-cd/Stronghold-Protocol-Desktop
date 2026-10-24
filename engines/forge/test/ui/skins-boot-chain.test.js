// The real entry point must register the sync. Testing installSkinsSync in isolation missed the desktop regression:
// the picker saved correctly while boot never sent any selection to the server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { startServer } from '../../server/index.js';
import { Match } from '../../server/match/Match.js';
import { Battle } from '../../server/sim/Battle.js';
import { TestClient } from '../helpers/wsClient.js';
import { createStore } from '../../public/js/store.js';
import { renderInfo } from '../../public/js/render/app/info.js';
import { spineEntry } from '../../public/js/assets.js';
import { UnitView } from '../../public/js/render/units.js';
import { makeMatch, DATA } from '../match/harness.js';

const OP = 'char_498_inside', SKIN = `${OP}@kitchen#2`, CHESS = 'chess_char_1_01_a';
const mainUrl = new URL('../../public/js/main.js', import.meta.url);

// Execute the production boot registration block, resolving its declared import rather than supplying a sync that
// main.js never imported. Other preference syncs are outside this regression; their registrations remain harmless.
async function bootSkinSync(net, target) {
  const source = readFileSync(mainUrl, 'utf8');
  const imported = source.match(/import \{ ([^}]+) \} from '\.\/ui\/loadoutSync\.js';/);
  assert.ok(imported, 'boot imports preference syncs');
  const module = await import(new URL('../../public/js/ui/loadoutSync.js', import.meta.url));
  let sync;
  const context = { net, installSupportSync() {} };
  for (const name of imported[1].split(',').map((s) => s.trim())) {
    assert.equal(typeof module[name], 'function', `the declared import ${name} resolves`);
    context[name] = name === 'installSkinsSync' ? (deps) => {
      sync = module[name]({ ...deps, target, timers: { setTimeout: () => 1, clearTimeout() {} } });
    } : () => {};
  }
  const start = source.indexOf('  installLoadoutSync({ net });');
  const end = source.indexOf('  installContent({ toast });', start);
  assert.ok(start > 0 && end > start, 'the real boot preference-registration block is present');
  vm.runInNewContext(source.slice(start, end), context);
  assert.ok(sync, 'boot actually registers installSkinsSync before connecting');
  return sync;
}

test('real boot → welcome/edit/reconnect/clear → WS seat → prep/scout/sim → selected Spine URL', async () => {
  let match;
  class RecordingMatch extends Match { constructor(opts) { super(opts); match = this; } }
  const errors = [];
  const srv = await startServer({ host: '127.0.0.1', port: 0, MatchClass: RecordingMatch,
    log: { info() {}, warn() {}, debug() {}, error: (...args) => errors.push(args.join(' ')) },
    heavyBurst: 20, heavyPerSec: 20 });
  let c, sync;
  try {
    c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);
    const listeners = new Map();
    const net = {
      status: 'offline',
      on(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
        return () => listeners.get(type).delete(fn);
      },
      async request(t, body) {
        const reply = await c.request({ t, ...body });
        if (reply.t === 'error') throw Object.assign(new Error(reply.detail || reply.code), reply);
        return reply;
      },
    };
    const bind = (client) => client.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.t === 'welcome') net.status = 'online';
      for (const fn of listeners.get(msg.t) || []) fn(msg);
    });
    bind(c);
    const target = createStore({ skins: { [OP]: SKIN }, skinsSync: 'idle' });
    sync = await bootSkinSync(net, target);
    const welcome = await c.hello('SkinBoot');
    await sync.flush();
    assert.equal(target.get().skinsSync, 'synced');
    const ok = async (msg) => assert.equal((await c.request(msg)).t, 'ok', msg.t);
    await ok({ t: 'room.create', mode: 'coop', difficulty: 'NORMAL', ...(welcome.mods ? { mods: welcome.mods.digest } : {}) });
    await ok({ t: 'room.start' });
    await c.waitFor('m.public', (p) => p.phase === 'INFO_CHECK');
    const ps = match.players.get(welcome.playerId);
    assert.deepEqual(ps.skins, { [OP]: SKIN }, 'boot preference reached the real lobby seat and Match');
    const p = ps.newPiece('chess', CHESS);
    ps.board.set('10,4', p);
    ps.hand[0] = ps.newPiece('chess', CHESS);
    ps.temp[0] = ps.newPiece('chess', CHESS);
    const model = { skel: '/test/selected.skel', atlas: '/test/selected.atlas', anims: { idle: 'Idle' } };
    const art = { chars: { [OP]: { spine: { front: { ...model, skel: '/test/default.skel' } },
      skins: { [SKIN]: { spine: { front: model } } } } } };
    const checkViews = (expected) => {
      for (const piece of [p, ps.hand[0], ps.temp[0]]) assert.equal(ps.pieceView(piece).skin, expected || undefined);
      const scout = match.prepFieldMeta(ps).units.find((u) => u.uid === p.uid);
      assert.equal(scout.skin, expected || undefined);
      const battle = new Battle({ fieldId: 'test', data: match.ds, players: [ps.battleInput()], spawns: [] });
      battle.start();
      const info = renderInfo(battle.fieldMeta().units.find((u) => u.uid === p.uid));
      assert.equal(info.spine, OP);
      assert.equal(info.skin, expected);
      const entry = UnitView.prototype._modelEntry.call({ info,
        ctx: { assets: { spineEntry: (id, opts) => spineEntry(art, id, opts) } } }, false);
      assert.equal(entry.skel, expected ? model.skel : '/test/default.skel', 'the production UnitView asks for the chosen model');
    };
    checkViews(SKIN);
    target.set({ skins: {} });
    await sync.flush();
    checkViews(null);
    target.set({ skins: { [OP]: SKIN } });
    await sync.flush();
    checkViews(SKIN);
    await c.terminate();
    net.status = 'offline';
    c = await TestClient.connect(`ws://127.0.0.1:${srv.port}/ws`);
    bind(c);
    const resumed = await c.hello('SkinBoot', welcome.token);
    assert.equal(resumed.playerId, welcome.playerId);
    await sync.flush();
    checkViews(SKIN);
    assert.ok(c.log.some((m) => m.t === 'm.public' && m.players?.some((v) => v.playerId === welcome.playerId && v.skins?.[OP] === SKIN)),
      'a real public WebSocket frame carries the owner choice');
    assert.deepEqual(errors, []);
  } finally {
    sync?.dispose();
    await c?.terminate();
    await srv.close();
  }
});

test('normal/elite, stand-in and filled DIY pieces use the same effective-body choice on every field surface', () => {
  const standIn = Object.values(DATA.chess).find((r) => !r.isGolden && r.chessType === 'NORMAL'
    && r.charId !== OP && r.backup?.charId && r.backup.charId !== r.charId);
  assert.ok(standIn);
  const diyBody = 'char_112_siege';
  const bodies = [OP, standIn.backup.charId, diyBody];
  const skins = Object.fromEntries(bodies.map((id) => [id, `${id}@test#1`]));
  const h = makeMatch({ mode: 'solo', seats: [{ seat: 0, playerId: 'p_0', name: 'P0', connected: true,
    skins, notOwned: [standIn.chessId], diy: { chess_char_5_diy1_a: { charId: diyBody, skillIndex: 0 } } }] });
  try {
    const ps = h.ps('p_0');
    const pairs = [[CHESS, OP], ['chess_char_1_01_b', OP], [standIn.chessId, standIn.backup.charId],
      ['chess_char_5_diy1_a', diyBody], ['chess_char_5_diy1_b', diyBody]];
    const pieces = pairs.map(([id, body], i) => {
      const piece = ps.newPiece('chess', id);
      ps.board.set(`10,${i}`, piece);
      return { piece, body };
    });
    const input = ps.battleInput();
    const battle = new Battle({ fieldId: 'test', data: h.m.ds, players: [input], spawns: [] });
    battle.start();
    const scout = h.m.prepFieldMeta(ps).units;
    for (const { piece, body } of pieces) {
      const expected = skins[body];
      assert.equal(ps.pieceView(piece).skin, expected, `own prep ${piece.id}`);
      assert.equal(input.units.find((u) => u.uid === piece.uid).skin, expected, `battle input ${piece.id}`);
      for (const raw of [scout.find((u) => u.uid === piece.uid), battle.fieldMeta().units.find((u) => u.uid === piece.uid)]) {
        const info = renderInfo(raw);
        assert.equal(info.spine, body, `effective model body ${piece.id}`);
        assert.equal(info.skin, expected, `scout/sim skin ${piece.id}`);
      }
    }
  } finally { h.m.dispose(); }
});
