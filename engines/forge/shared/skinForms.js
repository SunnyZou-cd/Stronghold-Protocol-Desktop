// Amiya's skins share charId in the official skin table, but tmplId selects the body.
// Official source: char_patch_table.infos.char_002_amiya.tmplIds and skin_table.charSkins[].tmplId.
// These are cosmetic body identities, separate from ordinary / elite chess variants and Spine animation forms.
export const AMIYA_BODY_IDS = Object.freeze(['char_002_amiya', 'char_1001_amiya2', 'char_1037_amiya3']);
const bodies = new Set(AMIYA_BODY_IDS);
const text = (v) => typeof v === 'string' && v ? v : null;

/** Character body behind an optional `_1` / `_2` art suffix. */
export function skinFormCharId(id) {
  return text(id)?.replace(/_(1|2)$/, '') || null;
}

/** The official Amiya skin key contains its tmplId, unlike its shared charId. */
export function skinBodyCharId(skinId) {
  const prefix = text(skinId)?.split(/[@#]/, 1)[0];
  return bodies.has(prefix) ? prefix : null;
}

/** Refuse a known Amiya outfit on another body; custom cosmetic-plugin keys keep their existing semantics. */
export function isSkinForForm(charId, skinId) {
  const body = skinFormCharId(charId), skinBody = skinBodyCharId(skinId);
  return !skinBody || body === skinBody;
}

/**
 * Look up one body's selection. Before tmplId-aware import, every Amiya choice was saved under the caster key.
 * Keep that old preference recoverable only on the body it belongs to; never erase or wear it on the caster.
 */
export function skinSelectionFor(charId, entries) {
  const body = skinFormCharId(charId);
  if (!body || !entries || typeof entries !== 'object') return null;
  const own = text(entries[body]);
  if (own) return isSkinForForm(body, own) ? own : null;
  if (bodies.has(body) && body !== AMIYA_BODY_IDS[0]) {
    const legacy = text(entries[AMIYA_BODY_IDS[0]]);
    if (skinBodyCharId(legacy) === body) return legacy;
  }
  return null;
}
