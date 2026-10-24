// The desktop bundle combines packs authored against different operator rosters.
// Derive the catalogue from the records actually loaded for this room, so a
// disabled pack cannot leave ghosts and a changed faction cannot leave old rows.
export function desktopBondMembers(data) {
  if (!Array.isArray(data?.config?.economy?.desktopAlliances)) return data;
  const records = Object.fromEntries(Object.entries(data.chess || {}).map(([id, c]) => [id,
    { ...c, bonds: (c.bonds || []).filter(b => data.bonds?.[b]) }]));
  const chess = Object.values(records).filter(c => c && !c.isGolden && !c.desktopCanonicalId);
  const bonds = { ...data.bonds };
  for (const [id, bond] of Object.entries(bonds)) {
    const candidates = chess.filter(c => c.bonds?.includes(id));
    const next = { ...bond };
    for (const field of ['members', 'visibleMembers']) {
      const expected = candidates.filter(c => field === 'members' || (c.visible !== false && !c.isHidden)).map(c => c.chessId);
      const allowed = new Set(expected);
      next[field] = [...new Set([...(bond[field] || []).filter(cid => allowed.has(cid)), ...expected])];
    }
    bonds[id] = next;
  }
  return { ...data, chess: records, bonds };
}
