// Local fan strategy, commissioned 2026-10-23. 24 research layers across all
// three upgrades; not device research points, and never a device breakthrough.
export function registerMeta(registry) {
  registry.band('band_ws_rhine_milestones', {
    onLevelUp(ctx, ev) {
      const p = ctx.source.band.params;
      const i = p.levels.indexOf(ev.level);
      if (i < 0) return;
      const key = `ws:rhine:milestone:${ev.level}`;
      if (ctx.counter(key)) return;
      ctx.setCounter(key, 1);
      ctx.addLayers(p.bond, p.layers[i], { requireActive: false, reason: 'band' });
    },
  });
}
