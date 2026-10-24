// Local fan strategy, commissioned 2026-10-23. Sciurus's one-purchase budget,
// scoped to Rhodes. Price previews are pure; the successful purchase consumes it.
export function registerMeta(registry) {
  const member = (ctx, id) => ctx.chessRecord(id)?.bonds?.includes(ctx.source.band.params.bond);
  const key = 'ws:rhodes:rotation:round';
  registry.band('band_ws_rhodes_rotation', {
    onPrice(ctx, ev) {
      if (ev.kind !== 'chess' || !member(ctx, ev.id) || ctx.counter(key) === ctx.round) return;
      ctx.setPrice(Math.min(ev.price, ctx.source.band.params.price));
    },
    onBuy(ctx, ev) {
      if (ev.kind === 'chess' && member(ctx, ev.slot.id)) ctx.setCounter(key, ctx.round);
    },
  });
}
