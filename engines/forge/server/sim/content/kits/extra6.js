// Custom six-tier operators. Values come from the selected official skill/talent blackboards.
// Grid adaptation: Angelina S2 controls the cast range without moving the deployed piece;
// S3 keeps her on her preparation tile. Sakiko notes use straight homing projectiles,
// no curved trajectories/piano piercing, Fever BGM or UI gauge. See docs/EXTRA-OPERATORS.md.
import { canTargetEnemy, sortEnemyTargets } from '../../targeting.js';
const live = u => u.alive && u.deployed && !u.hidden;
const foes = (b,u) => {
  const list=b.enemiesInKeys(u.rangeKeys,u,{canHitFly:true}).filter(e => canTargetEnemy(u,e,{canHitFly:true}));
  sortEnemyTargets(b,u,list,u.profile.priority);return list;
};
const talent = (def,i) => def.talents?.[i]?.bb ?? {};
const airborne = { liftoff:true, blockFly:true };

export function angelinaKit(bb,chess,def) {
  const index=chess.skill.index, t0=talent(def,0),t1=talent(def,1);
  const skill = { kind:index===2?'ammo':'duration', duration:chess.skill.duration>0?chess.skill.duration:0,
    ammo:bb['attack@trigger_time'], flags:airborne, mods:{atkPct:bb.atk??0},
    targeting:{rangeGrid:chess.skill.rangeGrid,maxTargets:bb['attack@max_target']??1},
    attack:{dmgType:index===1?'arts':'phys',atkScale:bb['attack@atk_scale']??1},
    onStart({battle:b,unit:u}) {
      b.releaseBlocked(u);
      if(index===1) {
        b.addBuff(u,{key:'aglna2:chant',duration:bb.chant_duration,flags:{disarm:true}});
        for(const e of foes(b,u)) {
          if(e.isFlying) b.applyStatus(e,'groundbind',{duration:bb.buff_duration_ground_bound,source:u});
          else b.applyStatus(e,'levitate',{duration:bb.buff_duration_levitate,source:u});
        }
      }
    },
    onEnd({battle:b,unit:u}) { if(index===2)b.setExtraRange(u,null);b.releaseBlocked(u); },
  };
  // base_attack_time is an additive interval change, not a percentage of the interval.
  if(index===1)skill.mods.batPct=(bb.base_attack_time??0)/chess.stats.bat;
  // Surrounding tiles are static grid offsets, rather than only the enemies present at activation.
  if(index===2)skill.targeting.rangeGrid=[...chess.skill.rangeGrid,...[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]];
  return {skills:{[chess.skill.skillId]:skill},install(b,u) {
    // The engine's stock skywalker blocks flyers even before take-off; this operator requires liftoff.
    b.removeBuff(u,'trait:skywalker');u.profile.blockFly=false;
    if(index===0)b.on('deploy',({unit})=>{if(unit===u)u.skill.activate('deploy');},{owner:u});
    u.profile.onEachHit=(battle,unit,e) => {
      if(e.alive)battle.dealDamage(unit,e,{amount:unit.s.atk*(e.s.massLevel<=(t0.mass_level??3)?t0.atk_scale_hi:t0.atk_scale_lo),type:'arts',tags:['talent','aglna2Extra']});
    };
    b.on('beforeAttack',c=>{
      if(c.attacker!==u||index!==2||!u.skill.active)return;
      const all=foes(b,u),n=bb['attack@max_walk_target']??3;
      c.targets=c.targets.slice(0,n);
      const extra=all.find(e=>e.isFlying&&!c.targets.includes(e));if(extra)c.targets.push(extra);
    },{owner:u});
    b.on('hit',c=>{
      if(c.target===u&&index===2&&u.skill.active&&c.source?.isFlying&&['phys','arts'].includes(c.dmg.type))c.dmg.mul=(c.dmg.mul??1)*(1-(bb.damage_resistance??0));
    },{owner:u});
    b.every(.1,()=>{
      if(!live(u))return;
      if(u.s.flags.liftoff)for(const e of foes(b,u))b.addBuff(e,{key:'aglna2:weightless',duration:.15,mods:{massFlat:-1}});
      for(const a of b.allies(u.ownerId).filter(a=>a.kind==='op'&&a.s.flags.liftoff))
        b.addBuff(a,{key:'aglna2:airAura',duration:.15,mods:{atkPct:t1.atk??0}});
      if(index===2&&u.skill.active)for(const e of foes(b,u).filter(e=>e.isFlying))
        b.addBuff(e,{key:'aglna2:airSlow',duration:.15,mods:{moveMul:1+(bb.move_speed??0)}});
    },{owner:u});
    b.every(1,()=>{
      if(!live(u))return;
      for(const a of b.allies(u.ownerId).filter(a=>a.kind==='op'&&a.s.flags.liftoff&&a.blocking.length))
        b.heal(u,a,a.s.maxHp*(t1.hp_recovery_per_sec_by_max_hp_ratio??0),{regen:true});
    },{owner:u});
  }};
}

export function sakikoKit(bb,chess,def) {
  const index=chess.skill.index,t0=talent(def,0),t1=talent(def,1);
  let shoot, isFever=()=>false;
  const skill=index===0?{kind:'charges',trigger:'NEVER',onStart(){for(let i=1;i<=8;i++)shoot?.('arts',bb[i===1?'atk_scale':`atk_scale_${i}`]??0);}}:
    index===1?{kind:'instant',onStart({battle:b,unit:u}){
      u.mem.sakikoOrgan=!u.mem.sakikoOrgan;
      b.addBuff(u,{key:'sakiko:timbre',persist:true,mods:u.mem.sakikoOrgan?{aspd:bb['attack@attack_speed']??0}:{atkPct:bb['attack@atk']??0}});
    }}:{kind:'duration',targeting:{rangeGrid:chess.skill.rangeGrid},
      onStart({unit}){unit.mem.sakikoFeverNew=isFever();},
      onTick({skill,dt}){if(isFever())skill.timeLeft+=dt;}
    };
  return {skills:{[chess.skill.skillId]:skill},install(b,u){
    u.profile.noAttack=true;
    u.mem.sakikoNotes=[];
    const state=b._sakikoFever??=(new Map());
    if(!state.has(u.ownerId))state.set(u.ownerId,{value:0,until:0});
    const fever=state.get(u.ownerId);let next=0,repeat=0,wasFever=false;
    const activeFever=()=>fever.until>b.time;isFever=activeFever;
    const prune=()=>{
      for(const p of u.mem.sakikoNotes){
        const inside=u.rangeKeySet.has(Math.round(p.y)*b.grid.cols+Math.round(p.x));
        if(inside)p._sakikoExitAt=null;else p._sakikoExitAt??=b.time;
        if(p._sakikoExitAt!=null&&b.time-p._sakikoExitAt>=(t0.delay??1))b.projectiles.list=b.projectiles.list.filter(q=>q!==p);
      }
      u.mem.sakikoNotes=u.mem.sakikoNotes.filter(p=>b.projectiles.list.includes(p));
      return Math.min(t0.max_cnt??10,u.mem.sakikoNotes.length);
    };
    shoot=(type='phys',scale=1,priority=null)=>{
      if(!live(u))return;
      const list=foes(b,u);if(priority)list.sort((a,z)=>z.s[priority]-a.s[priority]);
      const e=list[0],seq=u.deploySeq;
      const skillShot=index===1||u.skill.active;
      const moduleSkill=chess.module?.active&&skillShot;
      const rangedMul=e&&!moduleSkill?(u.profile.dmgMul?.(b,u,e)??1):1;
      const amount=u.s.atk*scale*rangedMul;
      const p=b.addProjectile({from:u,target:e,to:e?undefined:{x:u.x+u.fwd[1]*4,y:u.y+u.fwd[0]*4},
        speed:index===1&&u.mem.sakikoOrgan?2:4,visual:type==='arts'?'arts':'arrow',source:u,maxAge:5,
        onHit({target}){if(target&&live(u)&&u.deploySeq===seq)b.dealDamage(u,target,{amount,type,isAttack:true,isSkill:index===2&&u.skill.active,tags:['sakikoNote']});}});
      u.mem.sakikoNotes.push(p);
    };
    const reset=()=>{
      u.mem.sakikoOrgan=false;u.mem.sakikoFallen=false;next=b.time;
      b.removeBuff(u,'sakiko:timbre');
      if(index===1)b.addBuff(u,{key:'sakiko:timbre',persist:true,mods:{atkPct:bb['attack@atk']??0}});
    };
    reset();b.on('deploy',({unit})=>{if(unit===u)reset();},{owner:u});
    b.on('damaged',c=>{if(c.source===u&&c.amount>0&&!activeFever())fever.value=Math.min(450,fever.value+(t1.cnt??3));},{owner:u});
    b.on('skillStart',({unit})=>{
      if(unit===u&&fever.value>=450&&!activeFever()){fever.value=0;fever.until=b.time+20;b.fx('buff',{id:u.id,x:u.x,y:u.y,key:'Fever'});}
    },{owner:u});
    b.on('fatal',c=>{
      if(c.unit===u&&!c.prevented&&index===2&&u.skill.active&&activeFever()){
        c.prevented=true;u.hp=1;u.mem.sakikoFallen=true;
        b.addBuff(u,{key:'sakiko:feverSurvival',duration:fever.until-b.time,flags:{invulnerable:true,noHeal:true}});
      }
    },{owner:u,priority:-80});
    b.every(.05,()=>{
      if(!live(u))return;
      const f=activeFever();
      if(wasFever&&!f){if(index===2&&u.skill.active&&u.mem.sakikoFeverNew)u.skill.end('fever');if(u.mem.sakikoFallen){u.mem.sakikoFallen=false;b.kill(u);return;}}
      wasFever=f;
      if(f&&index===2&&!u.skill.active)u.skill.activate('fever',{free:true});
      if(f&&index===0&&b.time>=repeat){repeat=b.time+1;u.skill.activate('fever',{free:true});}
      if(index===0&&!f&&u.skill.charges===u.skill.maxCharges&&b.time>=u.skill.opReadyAt&&u.canAct&&!u.s.flags.silence)u.skill.activate('fullCharges');
      if(chess.module?.active)b.addBuff(u,{key:'sakiko:moduleTempo',duration:.1,mods:{aspd:foes(b,u).length>=2?(def.traitBb?.attack_speed??12):0}});
      const notes=prune();b.addBuff(u,{key:'sakiko:notes',duration:.1,mods:{defIgnorePct:notes*(t0.def_penetrate_ratio??0),resIgnorePct:notes*(t0.magic_resist_penetrate_ratio??0)}});
      for(const a of b.alliesInGrid(u).filter(a=>a.kind==='op'))b.addBuff(a,{key:'sakiko:tempo',duration:.1,mods:{aspd:t1.attack_speed??0}});
      if(u.s.flags.stun||u.s.flags.disarm||u.s.flags.sleep||b.time<next)return;
      next=b.time+u.s.interval;
      u.stats.attacks++;u.lastAttackAt=b.time;
      if(index===2&&u.skill.active){for(let n=0;n<2;n++){shoot('phys',bb['attack@atk_scale']??1,'res');shoot('arts',bb['attack@atk_scale']??1,'def');}}
      else for(let n=0;n<(index===1&&f?2:1);n++)shoot(index===1&&u.mem.sakikoOrgan?'arts':'phys');
      const targets=foes(b,u).slice(0,1);if(targets.length)b._ev(['atk',u.id,targets[0].id,'none']);
      if(b._hooks.attack)b.emit('attack',{attacker:u,targets,isSkill:index===2&&u.skill.active});
      u.skill.onAttackPerformed(targets,index===2&&u.skill.active);
    },{owner:u});
  }};
}
export default {chess_char_6_aglna2_a:angelinaKit,chess_char_6_oblvns_a:sakikoKit};
