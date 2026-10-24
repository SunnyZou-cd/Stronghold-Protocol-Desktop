/** Resolve a skin's cosmetic body from official client tables, never from its display name. */
export function officialSkinBody(skin, patchTable) {
  const root = skin?.charId;
  if (!root) throw new Error('Skin has no charId');
  const body = skin.tmplId || root;
  if (body !== root && !patchTable?.infos?.[root]?.tmplIds?.includes(body)) {
    throw new Error(`Unrecognised template ${body} for ${skin.skinId}`);
  }
  return body;
}

/** Rebuild only installed skins' grouping. Records and parsed Spine metadata remain byte-for-byte equivalent. */
export function remapOfficialSkinBodies(manifest, skinTable, patchTable) {
  const out = structuredClone(manifest);
  const moves = [];
  for (const [charId, record] of Object.entries(manifest.chars || {})) {
    for (const [skinId, entry] of Object.entries(record.skins || {})) {
      const official = skinTable.charSkins?.[skinId];
      if (!official) continue; // independent cosmetic plugins retain their own grouping
      const body = officialSkinBody(official, patchTable);
      if (body === charId) continue;
      out.chars[body] ||= {};
      out.chars[body].skins ||= {};
      if (out.chars[body].skins[skinId]) throw new Error(`Duplicate ${body}/${skinId}`);
      out.chars[body].skins[skinId] = structuredClone(entry);
      delete out.chars[charId].skins[skinId];
      moves.push({ skinId, from: charId, to: body, battleSkin: official.battleSkin });
    }
  }
  return { manifest: out, moves };
}
