const num = (v,d=0) => Number.isFinite(Number(v)) ? Number(v) : d;
const KEY2 = Object.freeze({
  DISCOUNT: 'custom_discount_next_buy',
  GRANT_ACQUIRE: 'custom_grant_item_on_acquire',
  GRANT_SELL: 'custom_grant_item_on_sell',
  PREP_END_TIERS: 'custom_gain_layers_prep_end_by_tiers',
  TRANSFORM_SELL: 'custom_transform_on_sell',
});
/** Player counter: the pending 休谟斯 discount (funds off the next purchase). */
const C_DISCOUNT = 'customgarrison:discount';
/**
 * Player counter: what `onPrice` just knocked off this purchase. `PlayerState.priceOf` dispatches `onPrice` every time
 * a price is asked for — the shop bar asks for every slot on every broadcast — so consuming the discount there would
 * burn it on a mere price preview. The discount is therefore spent on the `onBuy` hook instead, and only by the amount
 * that was actually applied to the purchase being paid for (buy() prices the slot, then dispatches onBuy).
 */
const C_APPLIED = 'customgarrison:discountApplied';

/** Grant `count` copies of `item` (used by the `<获得时>` / `<售出时>` traits). */
function grantCopies(ctx, item, count, why) {
  if (typeof item !== 'string' || !item) return 0;
  const n = Math.max(1, Math.floor(num(count, 1)));
  let gained = 0;
  for (let i = 0; i < n; i++) if (ctx.grantItem(item, { source: 'garrison' })) gained++;
  if (gained && typeof ctx.toast === 'function') ctx.toast(`【特质】获得${gained}件装备`, 'info');
  void why;
  return gained;
}

export function registerMeta(registry) {
  // 休谟斯 <获得时>: bank a discount, spent by the NEXT purchase of any chess or item (a player-level effect, so it
  // lives on a `global:` handler — per-piece `onPrice` garrisons only run for the piece being priced).
  registry.garrison(KEY2.DISCOUNT, {
    onGain(ctx) {
      const d = Math.floor(num(ctx.source.bb.discount));
      if (!(d > 0)) return;
      ctx.setCounter(C_DISCOUNT, ctx.counter(C_DISCOUNT) + d);
      if (typeof ctx.toast === 'function') ctx.toast(`【休谟斯】下一次购买资金-${d}`, 'info');
    },
  });
  registry.global('customgarrison_discount', {
    onPrice(ctx) {
      const d = ctx.counter(C_DISCOUNT);
      ctx.setCounter(C_APPLIED, d > 0 ? d : 0);
      if (d > 0) ctx.modifyPrice(-d);
    },
    onBuy(ctx) {
      const d = ctx.counter(C_APPLIED);
      if (!(d > 0)) return;
      ctx.setCounter(C_APPLIED, 0);
      // the purchase that just happened may itself have banked a discount (buying 休谟斯 runs its own onGain before
      // onBuy) — only the applied amount is spent, so the freshly banked one survives [ASSUMED: spend-on-buy semantics]
      ctx.setCounter(C_DISCOUNT, Math.max(0, ctx.counter(C_DISCOUNT) - d));
    },
  });

  // 阿米娅 / Mon3tr <获得时>: grant items.
  registry.garrison(KEY2.GRANT_ACQUIRE, {
    onGain(ctx) {
      grantCopies(ctx, ctx.source.bbStr.item, ctx.source.bb.count, 'gain');
    },
  });

  // Mon3tr <售出时>: grant items.
  registry.garrison(KEY2.GRANT_SELL, {
    onSold(ctx) {
      grantCopies(ctx, ctx.source.bbStr.item, ctx.source.bb.count, 'sold');
    },
  });

  // 迷迭香 <休整期结束时>: +gain per distinct tier among the bond's operators on the board.
  registry.garrison(KEY2.PREP_END_TIERS, {
    onPrepEnd(ctx) {
      const bond = typeof ctx.source.bbStr.bond === 'string' && ctx.source.bbStr.bond ? ctx.source.bbStr.bond : 'rhodesShip';
      if (!ctx.bondActive(bond)) return;
      const tiers = new Set();
      for (const p of ctx.board()) {
        if (!p || p.kind !== 'chess') continue;
        const rec = ctx.chessRecord(p.id);
        if (!rec || !Array.isArray(rec.bonds) || !rec.bonds.includes(bond)) continue;
        if (Number.isInteger(rec.tier)) tiers.add(rec.tier);
      }
      const n = tiers.size * Math.floor(num(ctx.source.bb.gain));
      if (n > 0) ctx.addLayers(bond, n, { requireActive: true, reason: 'garrison' });
    },
  });

  // 凯尔希 <售出时> / 煌 <售出时> / 烛煌 <售出时>: the sold piece becomes `bbStr.chess` (凯尔希 → Mon3tr, 煌 → 烛煌 and
  // the other way round). Transform in place when the piece is still known, otherwise gain the piece instead
  // [ASSUMED: the sell flow may already have detached it].
  registry.garrison(KEY2.TRANSFORM_SELL, {
    onSold(ctx, ev) {
      const chessId = ctx.source.bbStr.chess;
      if (typeof chessId !== 'string' || !chessId) return;
      const n = Math.max(1, Math.floor(num(ctx.source.bb.count, 1)));
      const uid = ctx.source.piece?.uid ?? ev?.piece?.uid;
      let done = 0;
      if (Number.isInteger(uid) && typeof ctx.transform === 'function' && ctx.transform(uid, chessId)) done = 1;
      while (done < n && typeof ctx.grantChess === 'function') { if (!ctx.grantChess(chessId)) break; done++; }
      if (done && typeof ctx.toast === 'function') {
        const to = ctx.chessRecord(chessId)?.name ?? chessId;
        const from = ctx.chessRecord(ctx.source.id)?.name ?? '';
        ctx.toast(`【特质】${from ? `${from} → ` : ''}${done}个${to}`, 'info');
      }
    },
  });
}
