// Desktop integration policy: one shop family per named operator/form, with the
// identity contributions of the packs actually selected for this room.
// Names are exact labels (NFKC + whitespace only); charId and template guard
// against unrelated homonyms and alternate forms. Never infer faction by nation.
export function desktopOperatorKey(c) {
  if (!c?.charId || !c.name || c.isDiy) return null;
  return JSON.stringify([String(c.name).normalize('NFKC').trim(), c.charId,
    c.backup?.tmplId ?? c.tmplId ?? null]);
}

export function desktopOperatorIdentity(data, sources = []) {
  if (!Array.isArray(data?.config?.economy?.desktopAlliances)) return data;
  const chess = { ...data.chess };
  const groups = new Map();
  for (const c of Object.values(chess)) {
    const key = desktopOperatorKey(c);
    if (!key || c.isGolden || !c.visible || c.isHidden) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const aliases = new Map();
  for (const [key, families] of groups) {
    // Existing/native family wins over an additional community family; IDs are
    // retained as hidden compatibility records for saved loadouts and summons.
    const winner = families[0];
    for (const c of families) {
      aliases.set(c.chessId, winner.chessId);
      if (c.goldenId && winner.goldenId) aliases.set(c.goldenId, winner.goldenId);
    }
    for (const golden of [false, true]) {
      const ids = families.map(c => golden ? c.goldenId : c.chessId).filter(Boolean);
      const records = [...sources, data].flatMap(s => Object.values(s?.chess || {})
        .filter(c => desktopOperatorKey(c) === key && !!c.isGolden === golden && !c.isHidden
          && (c.visible || (golden && s.chess[c.baseId]?.visible))));
      const bonds = [...new Set(records.flatMap(c => c.bonds || []))].filter(id => data.bonds?.[id]);
      const garrisonIds = [...new Set(records.flatMap(c => c.garrisonIds || []))].filter(id => data.garrisons?.[id]);
      const original = Object.values(sources[0]?.chess || {}).find(c => desktopOperatorKey(c) === key
        && !!c.isGolden === golden && (c.visible || (golden && sources[0].chess[c.baseId]?.visible)));
      const equalIds = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
      const modIdentity = !original || !equalIds(original.bonds, bonds) || !equalIds(original.garrisonIds, garrisonIds);
      for (const id of ids) if (chess[id]) chess[id] = { ...chess[id], bonds, garrisonIds,
        visible: id === (golden ? winner.goldenId : winner.chessId) && chess[id].visible,
        ...(modIdentity ? { desktopModIdentity: true } : {}),
        ...(id !== (golden ? winner.goldenId : winner.chessId)
          ? { desktopCanonicalId: golden ? winner.goldenId : winner.chessId } : {}) };
    }
  }
  const backups = { ...data.backups };
  if (backups.diy?.operators) {
    const operators = { ...backups.diy.operators };
    for (const c of Object.values(chess)) {
      if (!c.visible || c.isGolden || !c.desktopModIdentity || !operators[c.charId]) continue;
      const op = operators[c.charId];
      // DIY has its own skill/status, but its named identity sees the same
      // enabled factions. Its garrisons are projected in diyRecordOf below.
      if (desktopOperatorKey({ ...op, charId: c.charId }) === desktopOperatorKey(c)) {
        operators[c.charId] = { ...op, bonds: [...c.bonds] };
      }
    }
    backups.diy = { ...backups.diy, operators };
  }
  const support = data.support ? { ...data.support } : data.support;
  if (support?.pool) {
    support.pool = Object.fromEntries(Object.entries(support.pool).map(([tier, ids]) => [tier,
      [...new Set(ids.map(id => aliases.get(id) || id))].filter(id => chess[id]?.tier === Number(tier))]));
    if (support.prices) support.prices = Object.fromEntries(Object.entries(support.prices)
      .map(([id, price]) => [aliases.get(id) || id, price]));
  }
  return { ...data, chess, backups, ...(support ? { support } : {}) };
}

// Shared by the browser and server DIY projection. The desktop's selected
// roster is already materialised here; no installed-but-disabled pack is read.
export function desktopDiyIdentity(rec, data) {
  data = data?.source || data;
  if (!Array.isArray(data?.config?.economy?.desktopAlliances)) return rec;
  const key = desktopOperatorKey({ ...rec, isDiy: false });
  const normal = Object.values(data.chess || {}).find(c => c.visible && !c.isHidden && c.desktopModIdentity
    && !c.isGolden && desktopOperatorKey(c) === key);
  const match = normal && (rec.isGolden ? data.chess[normal.goldenId] : normal);
  return match ? { ...rec, bonds: [...match.bonds], garrisonIds: [...match.garrisonIds] } : rec;
}
