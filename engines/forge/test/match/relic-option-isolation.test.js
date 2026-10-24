import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';
import { grantRelic } from '../../server/match/relics.js';

test('disabled collectibles cannot grant collectibles or revive an eliminated teammate', () => {
  const h = makeMatch({ humans: 2, fake: true, relicsEnabled: false }).start().toPrep(1);
  try {
    const p = h.ps('p_0'), target = h.ps('p_1');
    assert.equal(grantRelic(p, 'relic_158'), null);
    assert.equal(h.m.pendingRelicDifficultyReduction, undefined);
    target.eliminate(1);
    p.relics = [{ id: 'relic_233', round: 1 }];
    assert.equal(h.m.reviveTeammate(p, 'relic_233', target.playerId).error, 'BAD_TARGET');
    assert.equal(target.eliminatedRoster, null);
  } finally { h.m.dispose(); }
});
