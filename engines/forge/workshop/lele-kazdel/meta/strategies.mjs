// Local fan strategy, commissioned 2026-10-23. Only a real chess merge emits
// this hook; equipment promotion / direct elite grants do not qualify.
export function registerMeta(registry) {
  registry.band('band_ws_kazdel_souls', {
    onMerge(ctx, ev) {
      const p = ctx.source.band.params;
      if (ev.kind !== 'chess' || !ctx.chessRecord(ev.piece?.id)?.isGolden) return;
      if (!ctx.chessRecord(ev.piece.id)?.bonds?.includes(p.bond)) return;
      const key = 'ws:kazdel:souls:round';
      if (ctx.counter(key) === ctx.round) return;
      ctx.setCounter(key, ctx.round);
      ctx.addLayers(p.bond, p.layers, { requireActive: false, reason: 'band' });
    },
  });
}
