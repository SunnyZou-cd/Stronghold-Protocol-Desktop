// Official skin prefab substitutions, scoped to a single wearer. The base index and other wearers never change.
// Descriptor aliases also rewrite nested effects (OnPlay, SequenceEffect, directional alternatives).
const lower = k => typeof k === 'string' ? k.toLowerCase() : k;

export function rewriteOutfit(value, names) {
  if (typeof value === 'string') return names.get(lower(value)) ?? value;
  if (Array.isArray(value)) return value.map(v => rewriteOutfit(v, names));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteOutfit(v, names)]));
}

export class OutfitIndex {
  constructor(index, library) {
    this.index = index;
    if (index) for (const group of ['skins', 'prefabs', 'projectiles']) index[group] ||= {};
    this.library = library;
    this.cache = new Map();
  }

  of(base, skin) {
    const index = this.index, outfit = index?.outfits?.[skin], variant = outfit?.tokenUnits?.[base];
    const tokenLook = outfit?.tokenLooks?.[base];
    const unit = index?.units?.[variant || base];
    const mounts = variant ? tokenLook?.mounts || index?.skins?.[variant] || index?.skins?.[base] : outfit?.mounts;
    if (!unit || !outfit || (outfit.charId !== base && !variant) || !mounts) return index;
    const key = `${base}|${skin}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const prefix = `outfit:${this.cache.size}:`, names = new Map(), substitutions = { ...outfit.replacements, ...tokenLook?.replacements };
    const target = k => Object.hasOwn(substitutions, k) ? substitutions[k] : k;
    const effects = new Set(), pending = [...(unit.refs || []), ...Object.keys(substitutions)];
    const fake = new Map([...(outfit.fakeProjectiles || []), ...(tokenLook?.fakeProjectiles || [])].map(p => [lower(p.originProjectileKey), p]));
    const projectile = k => {
      const f = fake.get(k), graphic = index.projectiles?.[lower(f?.graphicProjectileKey)];
      if (!graphic) return index.projectiles?.[k];
      const logic = index.projectiles?.[lower(f?.logicProjecitleKey)] || index.projectiles?.[k] || {};
      return { ...logic, ...graphic, effects: [...new Set([...(logic.effects || []), ...(graphic.effects || [])])],
        projectiles: [...new Set([...(logic.projectiles || []), ...(graphic.projectiles || [])])],
        behaviours: [...(graphic.behaviours || []), ...(logic.behaviours || []).filter(b => !/(?:Projectile|Movement)$/.test(b.class || ''))] };
    };
    const projectiles = new Set(unit.projectiles || []);
    const scan = value => {
      if (typeof value === 'string' && index.projectiles?.[lower(value)]) projectiles.add(lower(value));
      else if (Array.isArray(value)) value.forEach(scan);
      else if (value && typeof value === 'object') Object.values(value).forEach(scan);
    };
    scan(unit);
    const queue = [...projectiles];
    while (queue.length) {
      const k = queue.pop(), p = projectile(k);
      if (!p) continue;
      names.set(k, prefix + k);
      for (const sub of p.projectiles || []) if (!projectiles.has(sub)) { projectiles.add(sub); queue.push(sub); }
      pending.push(...(p.effects || []));
    }
    while (pending.length) {
      const original = lower(pending.pop());
      if (!original || effects.has(original)) continue;
      effects.add(original);
      const resolved = target(original);
      // An explicit empty replacement is intentional. A missing resource retains the original effect.
      if (!resolved || resolved === 'common_empty') { names.set(original, 'common_empty'); continue; }
      const actual = index.prefabs?.[resolved] ? resolved : original;
      if (!index.prefabs?.[actual]) continue;
      names.set(original, prefix + original);
      pending.push(...(index.prefabs[actual].refs || []));
    }
    const prefabs = { ...index.prefabs }, projs = { ...index.projectiles };
    for (const effect of effects) {
      const alias = names.get(effect);
      if (!alias || alias === 'common_empty') continue;
      const resolved = target(effect), actual = index.prefabs?.[resolved] ? resolved : effect;
      prefabs[alias] = rewriteOutfit(index.prefabs[actual], names);
      this.library.outfitAliases.set(alias, { source: actual, names });
    }
    for (const k of projectiles) {
      const p = projectile(k);
      if (p && names.has(k)) {
        projs[names.get(k)] = rewriteOutfit(p, names);
        // All wiring entry points resolve projectile ids through the shared index too. Private aliases cannot collide.
        index.projectiles[names.get(k)] = projs[names.get(k)];
      }
    }
    const dressed = rewriteOutfit(unit, names);
    dressed.skin = key;
    const own = { ...index, units: { ...index.units, [base]: dressed }, projectiles: projs, prefabs,
      skins: { ...index.skins, [key]: mounts }, outfitNames: names };
    // Mount lookup and alias summaries are read outside the per-unit planning helpers as well.
    index.skins[key] = mounts;
    Object.assign(index.prefabs, prefabs);
    this.cache.set(key, own);
    return own;
  }
}
