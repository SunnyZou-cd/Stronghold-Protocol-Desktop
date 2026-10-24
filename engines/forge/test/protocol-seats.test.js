import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SEATS } from '../shared/constants.js';
import { RESULT_LIMITS, isBattleResult, validateC2S } from '../shared/protocol.js';

const playerMap = (count, value) => Object.fromEntries(Array.from({ length: count }, (_, seat) => [`p_${seat}`, value(seat)]));
const resultFor = (count) => ({
  reason: 'cleared', time: 1,
  perPlayer: playerMap(count, () => ({ killed: 0, total: 0, leaked: [], perfect: true, layerGains: {}, unitsEnd: [] })),
});

test('room.removeBot accepts the fourth seat and rejects indexes outside the four-seat room', () => {
  assert.equal(MAX_SEATS, 4);
  assert.equal(validateC2S({ t: 'room.removeBot', seat: 3 }), null);
  for (const seat of [-1, 4, 3.5, '3']) {
    assert.equal(validateC2S({ t: 'room.removeBot', seat }), 'bad field seat');
  }
});

test('battle results accept four player records, reject a fifth, and still validate the fourth record', () => {
  assert.equal(RESULT_LIMITS.players, MAX_SEATS);
  const six = resultFor(4);
  assert.equal(isBattleResult(six), true);
  assert.equal(validateC2S({ t: 'b.result', battleId: 'battle_6', result: six }), null);
  const seven = resultFor(5);
  assert.equal(isBattleResult(seven), false);
  assert.equal(validateC2S({ t: 'b.result', battleId: 'battle_7', result: seven }), 'bad field result');
  six.perPlayer.p_3.killed = -1; // the fourth record must still pass per-player field validation
  assert.equal(isBattleResult(six), false);
});

test('battle progress accepts four attribution and leak counters, rejects five or a bad fourth counter', () => {
  const progress = {
    t: 'b.progress', battleId: 'battle_6', gt: 1, killed: 0, total: 0,
    by: playerMap(4, (seat) => seat * 10), left: playerMap(4, (seat) => seat),
  };
  assert.equal(validateC2S(progress), null);
  assert.equal(validateC2S({ ...progress, by: playerMap(5, () => 0) }), 'bad field by');
  assert.equal(validateC2S({ ...progress, left: playerMap(5, () => 0) }), 'bad field left');
  assert.equal(validateC2S({ ...progress, by: { ...progress.by, p_3: -1 } }), 'bad field by');
  assert.equal(validateC2S({ ...progress, left: { ...progress.left, p_3: 1.5 } }), 'bad field left');
});
