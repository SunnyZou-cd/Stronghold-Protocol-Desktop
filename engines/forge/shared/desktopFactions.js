import { DESKTOP_FACTIONS } from './desktopFactionData.js';

// Native Lele callbacks remain in the host; only the selected faction's data is
// assembled into this room before ordinary workshop overlays are applied.
export function desktopFactions(base, packs) {
  if (!Array.isArray(base?.config?.economy?.desktopAlliances)) return base;
  const ids = new Set((packs || []).map(p => p.id));
  const selected = ['rhine', 'kazdel'].filter(id => ids.has(`lele-${id}`));
  const out = { ...base };
  for (const faction of selected) {
    for (const [table, records] of Object.entries(DESKTOP_FACTIONS.changes[faction])) out[table] = { ...out[table], ...records };
  }
  // Columbia's summon is shared with the native Rhine operator. Its author
  // supplied that same summon before the initial integration deduplicated it.
  if (ids.has('columbia') && !out.tokens?.token_10070_aphris_pc) out.tokens = {
    ...out.tokens, token_10070_aphris_pc: DESKTOP_FACTIONS.changes.rhine.tokens.token_10070_aphris_pc,
  };
  const config = JSON.parse(JSON.stringify(base.config));
  config.economy.leleHost.enabled.factions = selected.length > 0;
  if (selected.length) config.bans = DESKTOP_FACTIONS.bans;
  for (const mode of Object.values(config.modes || {})) {
    if (Array.isArray(mode.activeBondIds)) mode.activeBondIds = [...new Set([...mode.activeBondIds, ...selected.map(id => id + 'Ship')])];
  }
  out.config = config;
  const tokens = { ...base.backups?.tokens };
  for (const faction of selected) for (const id of DESKTOP_FACTIONS.backupTokenRemovals[faction]) delete tokens[id];
  out.backups = { ...out.backups, tokens };
  return out;
}
