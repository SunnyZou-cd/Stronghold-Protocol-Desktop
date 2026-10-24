// server/sim/content/garrisons/custom.js — the fan-made 特质 (traits) of the 卡兹戴尔 / 罗德岛 operators
// (the pack's records.json `garrisons`, roster in docs/research/custom-operators.json).
//
// The effect key (the garrison's `bbStr.key`) selects the behaviour, exactly like garrisons/battle.js does for the
// official ones. Numbers live on the garrison's own record, so the normal `_a` and the elite `_b` variant differ
// only in their blackboard.
//
//   custom_gain_first_skill      <战斗中>first skill cast → own bonds +gain          (陨星)
//   custom_gain_on_skill         <战斗中>every skill cast → own bonds +gain          (坚雷)
//   custom_gain_on_heal          <战斗中>every heal of an ally → own bonds +gain, cap (闪灵)
//   custom_gain_on_hurt_or_heal  <战斗中>healed or damaged → own bonds +gain, cap     (赫德雷)
//   custom_gain_on_kills         <战斗中>every `per_kills` enemies killed in range → own bonds +gain, cap (阿斯卡纶)
//   custom_gain_on_controlled    <战斗中>per enemy in range under 眩晕/停顿/束缚, per second → kazdelShip +gain (维什戴尔)
//   custom_gain_on_new_target    <战斗中>attacking a NEW enemy → rhodesShip +gain, cap (霜叶)
//   custom_scale_bonds_layers    listed bonds 每叠加 `per_layers` 层 → 本干员 ATK +atk          (逻各斯)
//
// 隐德来希 is NOT here: the season already ships its 特质 (`garrison_10`, 核心盟约每叠加3层 +1 %/2 % ATK / HP) and the
// engine implements it (garrisons/battle.js `act1autochess_gar_eff_attrByBond`), so the pack re-lists that record with its
// two new core bonds appended (records.json) instead of shipping a second copy of it — a copy showed twice on the detail
// card (作战能力 + 持续叠加) and applied the bonus twice (owner's report, 2026-10-08).
//
// Layer wording: "使已激活的…" → requireActive true (the owner's ACTIVE bonds); "自身所属盟约" → the owner's bonds,
// active ones only (gainLayers' requireActive). Caps go through gainLayers' `cap` / `capKey` (per instance, per bond,
// per battle).

import * as S from '@battle/index.js';

export const KEY = Object.freeze({
  FIRST_SKILL: 'custom_gain_first_skill',
  ON_SKILL: 'custom_gain_on_skill',
  ON_HEAL: 'custom_gain_on_heal',
  ON_HURT: 'custom_gain_on_hurt_or_heal',
  ON_KILLS: 'custom_gain_on_kills',
  ON_CONTROLLED: 'custom_gain_on_controlled',
  ON_NEW_TARGET: 'custom_gain_on_new_target',
  SCALE_BONDS: 'custom_scale_bonds_layers',
});

const num = S.num;
const EMPTY = Object.freeze([]);
const CONTROLLED_POLL = 1; // s — 维什戴尔's "每有一个敌人处于眩晕、束缚时 +1 层"

/** The custom garrison records of a unit (empty for the official pool). */
function garrisonsOf(u) {
  const list = u?.def?.raw?.garrisonIds ?? u?.def?.garrisonIds;
  if (!Array.isArray(list) || !list.length) return EMPTY;
  const out = [];
  for (const id of list) {
    const g = S.garrisonRecord(id);
    if (["garrison_35_a","garrison_35_b","garrison_c_durnar_a","garrison_c_durnar_b","garrison_c_ascln_k_a","garrison_c_ascln_k_b","garrison_c_frostl_a","garrison_c_frostl_b","garrison_c_logos_a","garrison_c_logos_b","garrison_c_humus_a","garrison_c_humus_b","garrison_c_amiya_a","garrison_c_amiya_b","garrison_c_monstr_gain_a","garrison_c_monstr_gain_b","garrison_c_monstr_sell_a","garrison_c_monstr_sell_b","garrison_c_rosmon_a","garrison_c_rosmon_b","garrison_c_kalts_a","garrison_c_kalts_b","garrison_c_huang_a","garrison_c_huang_b"].includes(id) && g && g.bbStr && typeof g.bbStr.key === 'string' && g.bbStr.key.startsWith('custom_')) out.push(g);
  }
  return out;
}

const isOp = (u) => !!u && u.kind === 'op';
const onField = (u) => !!u && u.alive && u.deployed;

/** The owner's own bonds that are active right now. */
function ownActiveBonds(battle, u) {
  return S.unitBonds(u).filter((b) => S.bondActive(battle, u.ownerId, b));
}

/** Enemy under 眩晕 / 停顿 / 束缚 / 不动. */
function controlled(t) {
  if (!t || !t.findBuff) return false;
  const f = t.s && t.s.flags;
  if (f && (f.stun || f.bind || f.immobile || f.rooted)) return true;
  return !!(t.findBuff('stun') || t.findBuff('sluggish') || t.findBuff('bind') || t.findBuff('immobile'));
}

// =====================================================================================================================
// battle side

export function install(battle) {
  if (!battle) return;
  /** Every operator of every player that carries a custom trait, with its records. */
  const owners = [];
  for (const p of battle.players || []) {
    for (const u of S.playerOps(battle, p.playerId)) {
      const gs = garrisonsOf(u);
      if (gs.length) owners.push({ u, gs });
    }
  }
  if (!owners.length) return;

  const byKey = new Map();
  for (const o of owners) {
    for (const g of o.gs) {
      const k = g.bbStr.key;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push({ u: o.u, g, bb: g.bb || {} });
    }
  }
  const has = (k) => byKey.has(k);
  const gain = (u, bonds, n, cap, capKey) => S.gainLayers(battle, {
    playerId: u.ownerId, bonds, n, requireActive: true, source: u, reason: 'garrison',
    cap: Number.isFinite(cap) ? cap : Infinity, capKey: capKey ? `${capKey}:${u.uid ?? u.defId}` : null,
  });

  // ---- skill casts ------------------------------------------------------------------------------------------------
  if (has(KEY.FIRST_SKILL) || has(KEY.ON_SKILL)) {
    battle.on('skillStart', ({ unit }) => {
      if (!isOp(unit)) return;
      for (const rec of byKey.get(KEY.FIRST_SKILL) || []) {
        if (rec.u !== unit || unit.mem.customFirstSkill) continue;
        unit.mem.customFirstSkill = true;
        gain(unit, ownActiveBonds(battle, unit), num(rec.bb.gain), Infinity, null);
      }
      for (const rec of byKey.get(KEY.ON_SKILL) || []) {
        if (rec.u !== unit) continue;
        gain(unit, ownActiveBonds(battle, unit), num(rec.bb.gain), Infinity, null);
      }
    });
  }

  // ---- healing ----------------------------------------------------------------------------------------------------
  if (has(KEY.ON_HEAL) || has(KEY.ON_HURT)) {
    battle.on('heal', (c) => {
      const src = c.source, tgt = c.target;
      if (!isOp(tgt) || !(num(c.amount) > 0)) return;
      for (const rec of byKey.get(KEY.ON_HEAL) || []) {
        if (rec.u !== src) continue;
        gain(rec.u, ownActiveBonds(battle, rec.u), num(rec.bb.gain), num(rec.bb.max, Infinity), KEY.ON_HEAL);
      }
      for (const rec of byKey.get(KEY.ON_HURT) || []) {
        if (rec.u !== tgt) continue;
        gain(rec.u, ownActiveBonds(battle, rec.u), num(rec.bb.gain), num(rec.bb.max, Infinity), KEY.ON_HURT);
      }
    });
    battle.on('damaged', (c) => {
      const tgt = c.target, dmg = c.dmg;
      if (!isOp(tgt) || !dmg || dmg.cancelled) return;
      for (const rec of byKey.get(KEY.ON_HURT) || []) {
        if (rec.u !== tgt) continue;
        gain(rec.u, ownActiveBonds(battle, rec.u), num(rec.bb.gain), num(rec.bb.max, Infinity), KEY.ON_HURT);
      }
    });
  }

  // ---- kills in range (阿斯卡纶) ----------------------------------------------------------------------------------
  if (has(KEY.ON_KILLS)) {
    battle.on('death', (c) => {
      const victim = c.unit;
      if (!victim || victim.side !== 'enemy') return;
      for (const rec of byKey.get(KEY.ON_KILLS) || []) {
        const u = rec.u;
        if (!onField(u)) continue;
        const keys = Array.isArray(u.rangeKeys) ? u.rangeKeys : [];
        if (!keys.length) continue;
        // `death` fires once the victim is already dead, so a live-target query never lists it (`enemiesInKeys`
        // filters `alive`): ask its BODY instead (owner's report, 2026-10-08 「阿斯卡纶的特质没有正常生效」 — three
        // enemies killed inside her range counted nothing). No target profile either: 攻击范围内**所有**敌人 —
        // 地面与空中都算 (owner 2026-10-08) — while her 伏击客 profile is `canHitFly: false`, so the old call would
        // have dropped every air kill even after the `alive` filter was fixed.
        if (!S.bodyInKeys(victim, keys)) continue;
        u.mem[`${KEY.ON_KILLS}:n`] = (u.mem[`${KEY.ON_KILLS}:n`] ?? 0) + 1;
        const per = Math.max(1, num(rec.bb.per_kills, 2));
        if (u.mem[`${KEY.ON_KILLS}:n`] % per) continue;
        gain(u, ownActiveBonds(battle, u), num(rec.bb.gain), num(rec.bb.max, Infinity), KEY.ON_KILLS);
      }
    });
  }

  // ---- controlled enemies in range (维什戴尔) ---------------------------------------------------------------------
  if (has(KEY.ON_CONTROLLED)) {
    const list = byKey.get(KEY.ON_CONTROLLED);
    battle.every(CONTROLLED_POLL, () => {
      for (const rec of list) {
        const u = rec.u;
        if (!onField(u)) continue;
        const keys = Array.isArray(u.rangeKeys) ? u.rangeKeys : [];
        if (!keys.length) continue;
        for (const e of battle.enemiesInKeys(keys, u, u.profile)) {
          if (!controlled(e)) continue;
          gain(u, ['kazdelShip'], num(rec.bb.gain), Infinity, null);
        }
      }
    });
  }

  // ---- attacking a new enemy (霜叶) -------------------------------------------------------------------------------
  if (has(KEY.ON_NEW_TARGET)) {
    const list = byKey.get(KEY.ON_NEW_TARGET);
    battle.on('damaged', (c) => {
      const u = c.source, t = c.target, dmg = c.dmg;
      if (!dmg || !dmg.isAttack || !t || t.side !== 'enemy') return;
      for (const rec of list) {
        if (rec.u !== u) continue;
        const seen = (u.mem.customTargets ??= new Set());
        const key = t.uid ?? t.id;
        if (seen.has(key)) continue;
        seen.add(key);
        gain(u, ['rhodesShip'], num(rec.bb.gain), num(rec.bb.max, Infinity), KEY.ON_NEW_TARGET);
      }
    });
  }

  // ---- layer scaling (逻各斯) -------------------------------------------------------------------------------------
  const scalers = byKey.get(KEY.SCALE_BONDS) || [];
  if (scalers.length) {
    const apply = (rec) => {
      const u = rec.u;
      // the core bonds PLUS the extras listed in the record's `bbStr.bonds` (逻各斯: 「核心盟约和【远见】每叠加3层」).
      // The record keeps that list in bbStr, not bb.
      const bonds = [...S.coreBondIds(), ...ids(rec.g.bbStr?.bonds ?? '')];
      let layers = 0;
      for (const b of bonds) if (S.bondActive(battle, u.ownerId, b)) layers += S.bondLayers(battle, u.ownerId, b);
      const per = Math.max(1, num(rec.bb.per_layers, 3));
      const steps = Math.floor(layers / per);
      if (!(steps > 0)) { battle.removeBuff(u, `gar:${rec.g.garrisonId}`); return; }
      const mods = S.directMods({ atk: num(rec.bb.atk) * steps, hp: num(rec.bb.hp) * steps });
      S.passiveBuff(battle, u, `gar:${rec.g.garrisonId}`, mods);
    };
    for (const rec of scalers) apply(rec);
    battle.on('layerGain', () => {
      // the gain is recorded AFTER the hook — re-read the live layers next tick (bonds/core.js does the same)
      for (const rec of scalers) battle.after(0, () => apply(rec));
    });
    battle.on('deploy', () => {
      for (const rec of scalers) apply(rec);
    });
  }
}

const ids = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

// =====================================================================================================================
