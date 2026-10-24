// 结城理: official skill blackboards; the mode's garrison stays in garrisons/battle.js.
import { weaknessType, WEAKNESS_PRIORITY } from '../garrisons/battle.js';
import { DOLL_SWITCH } from '../../professions.js';

export function makotoKit(bb, chess) {
  const sid = chess.skill.skillId;
  const s1 = sid === 'skchr_makoto_1', s2 = sid === 'skchr_makoto_2';
  const t0 = chess.talents.find(t => t.index === 0)?.bb ?? {};
  const t1 = chess.talents.find(t => t.index === 1)?.bb ?? {};
  const grid = chess.trait.rangeGrid;
  const skill = { kind: 'instant', onStart({ battle, unit }) {
    if (!unit.trait.doll) battle.emit('dollSwitch', { unit, reason: 'skill', done: false });
  } };
  return {
    skills: { skchr_makoto_1: skill, skchr_makoto_2: skill, skchr_makoto_3: skill },
    install(b, u) {
      const bodyProfile = { ...u.profile }, bodyRange = u.rangeGrid;
      let persona = null;
      const enemies = (fly = false) => b.unitsInGrid(u, grid, { side: 'enemy' }).filter(e => fly || !e.isFlying);
      const allies = () => b.unitsInGrid(u, grid, { side: 'ally' }).filter(a => a.kind === 'op');
      const refresh = () => {
        u.rangeGrid = persona ? grid : bodyRange;
        u.form = persona ? (s1 ? 'makoto_s1' : s2 ? 'makoto_s2' : persona === 'thanatos' ? 'makoto_s3a' : 'makoto_s3b') : null;
        u.profile = { ...bodyProfile };
        if (persona) {
          b.addBuff(u, { key: 'makoto:persona', flags: { silence: true }, mods: { atkMul: 1 + t0.atk, hpMul: (1 + t0.max_hp_t1) * (1 + (chess.trait.bb.max_hp ?? 0)),
            batPct: t0.base_attack_time / u.base.bat,
            aspd: !s1 && !s2 ? bb['talent@attack_speed'] : 0 } });
          u.profile.attack = 'ranged';
          u.profile.projectile = 'none';
          u.profile.dmgType = 'arts';
          u.profile.canHitFly = !s1 && !s2;
          u.profile.atkScale = bb['attack@atk_scale'];
          u.profile.maxTargets = s1 ? 1 : bb['attack@max_target'];
          if (s1) {
            u.profile.canAttack = () => {
              const hurt = b.injuredAlliesInKeys(u.rangeKeys, u).some(a => a.hpRatio <= 0.5);
              u.profile.dmgType = hurt ? 'heal' : 'arts';
              u.profile.heal = hurt ? { mode: 'single', hpAtMost: 0.5 } : null;
              u.profile.atkScale = hurt ? bb['attack@heal_scale'] : bb['attack@atk_scale'];
              return true;
            };
          }
          if (persona === 'orpheus' && !s1) {
            u.profile.noAttack = true;
            // The branch's zero block is overridden in this S3 form (normal 2-block restored).
            const sub = u.findBuff('trait:substitute');
            if (sub) sub.mods.blockCnt = bb['attack@block_cnt'] - u.base.blockCnt;
          }
        } else b.removeBuff(u, 'makoto:persona');
        u.markDirty(); b.refreshRange(u);
      };
      const healPulse = () => {
        if (!u.alive || !u.deployed || u.trait.dollSwitching || persona !== 'orpheus' || s1) return;
        const seq = u.deploySeq;
        const list = b.injuredAlliesInKeys(u.rangeKeys, u).slice(0, bb['attack@max_target_heal']);
        b.after(0.5, () => {
          if (!u.alive || !u.deployed || u.deploySeq !== seq || persona !== 'orpheus') return;
          for (const a of list) if (a.alive && a.deployed) b.heal(u, a, u.s.atk * bb['attack@heal_scale']);
        }, { owner: u });
      };
      const orpheus = () => {
        if (!u.trait.doll || u.trait.dollSwitching || u.findBuff('makoto:changing') || persona !== 'thanatos' || s1 || s2) return false;
        persona = 'orpheus';
        // This is a substitute-to-substitute change; the 20 s window and garrison count do not restart.
        b.addBuff(u, { key: 'makoto:changing', duration: DOLL_SWITCH,
          flags: { invulnerable: true, noSp: true, noHeal: true, isolated: true, disarm: true },
          onExpire: healPulse });
        refresh(); u.hp = u.s.maxHp;
        b.fx('substitute', { x: u.x, y: u.y, id: u.id, form: u.form });
        return true;
      };
      b.on('dollChanged', ({ unit, doll }) => {
        if (unit !== u) return;
        persona = doll ? (s1 ? 'orpheus' : 'thanatos') : null;
        refresh();
        if (doll) {
          for (const e of enemies(true)) b.applyStatus(e, 'sluggish', { duration: t0.sluggish, source: u });
        } else {
          // Only natural return triggers the all-out attack; a substitute KO uses the death hook instead.
          for (const e of enemies(true)) b.dealDamage(u, e, { amount: u.s.atk * t1.atk_scale, type: 'true', tags: ['talent', 'makotoAllOut'] });
        }
      }, { owner: u });
      b.on('fatal', c => {
        if (c.unit !== u || c.prevented) return;
        if (u.findBuff('makoto:changing') || orpheus()) c.prevented = true;
      }, { owner: u, priority: -90 });
      b.on('hit', c => {
        if (c.source === u && c.dmg.isAttack && persona === 'thanatos' && !s2) c.dmg.type = weaknessType(u, c.target, c.dmg);
      }, { owner: u, priority: WEAKNESS_PRIORITY });
      b.on('damaged', c => {
        if (s2 && persona === 'thanatos' && c.source === u && c.dmg.isAttack && c.target.alive && b.rng.chance(bb['attack@prob'])) {
          b.applyStatus(c.target, 'fear', { duration: bb['attack@fear'], source: u });
        }
      }, { owner: u });
      b.every(0.1, () => {
        if (!u.alive || !u.deployed || u.trait.dollSwitching || !persona) return;
        if (s2) for (const e of enemies(true)) if (e.s.flags.fear && e.hp <= u.s.atk * bb['attack@kill_atk_scale']) {
          b.dealDamage(null, e, { amount: bb['attack@kill_damage'], type: 'true', tags: ['execute'] });
        }
        if (persona === 'orpheus' && !s1) for (const a of allies()) b.addBuff(a, {
          key: 'makoto:dodge', duration: 0.15, mods: { dodgePhys: bb['attack@prob'], dodgeArts: bb['attack@prob'] }, source: u });
      }, { owner: u });
      b.every(bb['attack@interval'] ?? 1, healPulse, { owner: u });
      b.on('death', ({ unit }) => {
        if (unit !== u) return;
        persona = null; refresh();
      }, { owner: u });
    },
  };
}
