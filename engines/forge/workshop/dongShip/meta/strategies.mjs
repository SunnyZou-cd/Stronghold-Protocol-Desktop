// Local fan strategy, commissioned 2026-10-23. Budget mirrors Chiave's official
// six manual refreshes / at most two grants per round, with the Dong member pool.
export function registerMeta(registry) {
  registry.band('band_ws_dong_invitation', {
    onRefresh(ctx) {
      const p = ctx.source.band.params;
      const key = 'ws:dong:invitation';
      const count = ctx.incCounter(`${key}:refreshes`, 1);
      if (count % p.refresh_count !== 0) return;
      if (ctx.counter(`${key}:round`) !== ctx.round) {
        ctx.setCounter(`${key}:round`, ctx.round);
        ctx.setCounter(`${key}:grants`, 0);
      }
      if (ctx.counter(`${key}:grants`) >= p.max_count) return;
      const id = ctx.rollChess({ bond: p.bond, maxTier: ctx.shopLevel() });
      if (id && ctx.grantChess(id, { source: 'band' })) ctx.incCounter(`${key}:grants`, 1);
    },
  });
}
