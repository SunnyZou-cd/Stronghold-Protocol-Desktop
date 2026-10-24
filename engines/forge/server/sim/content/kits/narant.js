// Native boomerang flight/return; S1 bounces and S2 return-path damage are resolved at impact.
import { canTargetEnemy } from '../../targeting.js';
const AROUND8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
export function narantKit(bb,chess,def){
 const moduleX=chess.module?.active&&chess.module.id==='uniequip_002_narant', moduleY=chess.module?.active&&chess.module.id==='uniequip_003_narant';
 const near=(u,e)=>Math.max(Math.abs(e.x-u.x),Math.abs(e.y-u.y))<=1;
 const index=chess.skill.index,t0=def.talents?.[0]?.bb??{},t1=def.talents?.[1]?.bb??{};
 const skill={kind:index===0?'toggle':'duration',mods:{},attack:{atkScale:bb['attack@atk_scale']??1}};
 if(index===0)skill.targeting={rangeGrid:chess.skill.rangeGrid??chess.rangeGrid.map(([r,c])=>[r,c]).filter(([r,c])=>c<Math.max(...chess.rangeGrid.map(x=>x[1])))};
 if(index===2){skill.attack.boomerangCount=bb.cnt??3;skill.attack.onBoomerangCatch=(b,u)=>{
  if(u.trait.boomerangsOut!==0)return;
  const list=b.unitsInGrid(u,AROUND8,{side:'enemy'}).filter(e=>canTargetEnemy(u,e,{canHitFly:true})).slice(0,bb['attack@aoe.max_target']??3);
  for(const e of list){b.dealDamage(u,e,{amount:u.s.atk*(bb.atk_scale_aoe??1),type:'phys',isSkill:true,tags:['narantReturnBurst']});b.applyStatus(e,'sluggish',{duration:bb.sluggish??1,source:u});}
 };}
 if(index===1)skill.attack.onHit=({battle:b,unit:u,target:e})=>{
  if(!e)return;b.applyStatus(e,'sluggish',{duration:bb['attack@sluggish']??1,source:u});
  const dx=u.x-e.x,dy=u.y-e.y,len=dx*dx+dy*dy;
  for(const v of b.aliveEnemies()){
   const f=len?Math.max(0,Math.min(1,((v.x-e.x)*dx+(v.y-e.y)*dy)/len)):0;
   if(Math.hypot(v.x-e.x-f*dx,v.y-e.y-f*dy)<=(bb['attack@projectile_range']??1)/2)
    b.dealDamage(u,v,{amount:u.s.atk*(bb['attack@atk_scale_comeback']??1),type:'phys',isSkill:true,isAttack:true,tags:['narantReturnPath']});
  }
 };
 if(index===0)skill.attack.onHit=({battle:b,unit:u,target:e})=>{
  let last=e;if(!last)return;
  for(let i=0;i<(bb['attack@times']??3);i++){
   const list=b.aliveEnemies().filter(v=>canTargetEnemy(u,v,{canHitFly:true})&&Math.hypot(v.x-last.x,v.y-last.y)<=1.5);
   list.sort((a,z)=>Math.hypot(a.x-last.x,a.y-last.y)-Math.hypot(z.x-last.x,z.y-last.y));
   const next=list.find(v=>v!==last)??(last.alive?last:null);if(!next)break;
   b.dealDamage(u,next,{amount:u.s.atk*(bb['attack@atk_scale']??1),type:'phys',isAttack:true,isSkill:true,tags:['narantBounce']});last=next;
  }
 };
 return {skills:{[chess.skill.skillId]:skill},install(b,u){
  let atk=0,defense=0,lastDamage=b.time,catches=0;const stolen=new Map();
  const catchBonus=(battle,unit)=>{if(moduleY&&++catches%5===0)unit.skill.gainSp(def.traitBb?.sp??1,'module');};
  const priorCatch=skill.attack.onBoomerangCatch;
  u.profile.onBoomerangCatch=catchBonus;skill.attack.onBoomerangCatch=(battle,unit)=>{catchBonus(battle,unit);priorCatch?.(battle,unit);};
  b.on('deploy',({unit})=>{if(unit===u){lastDamage=b.time;catches=0;}},{owner:u});
  if(moduleY)b.every(.1,()=>{if(!u.alive||!u.deployed)return;const m=chess.talents.find(t=>t.index===-1&&t.bb?.interval)?.bb;
    if(b.time-lastDamage>=(m?.interval??6))b.addBuff(u,{key:'narant:unhurt',duration:.15,mods:{atkPct:m?.atk??.15}});else b.removeBuff(u,'narant:unhurt');
  },{owner:u});
  b.addBuff(u,{key:'narant:dodge',persist:true,mods:{dodgePhys:t1.prob??0,dodgeArts:t1.prob??0}});
  b.on('damaged',c=>{
   if(c.target===u&&c.amount>0)lastDamage=b.time;
   if(c.source!==u||!c.dmg.isAttack||!u.alive||!u.deployed)return;
   const e=c.target;if(e.side!=='enemy')return;
   const a=Math.min((t0['attack@steal_atk']??0)*(moduleX&&near(u,e)?2:1),Math.max(0,(t0['attack@steal_atk_max']??0)-atk),e.s.atk);
   const d=Math.min((t0['attack@steal_def']??0)*(moduleX&&near(u,e)?2:1),Math.max(0,(t0['attack@steal_def_max']??0)-defense),e.s.def);
   atk+=a;defense+=d;const st=stolen.get(e)??{atk:0,def:0};st.atk+=a;st.def+=d;stolen.set(e,st);
   b.addBuff(e,{key:`narant:stolen:${u.id}`,mods:{atkFlat:-st.atk,defFlat:-st.def}});
   b.addBuff(u,{key:'narant:steal',mods:{atkFlat:atk,defFlat:defense}});
  },{owner:u});
  b.on('death',({unit})=>{if(unit!==u)return;for(const e of stolen.keys())b.removeBuff(e,`narant:stolen:${u.id}`);stolen.clear();atk=0;defense=0;},{owner:u});
  // Enemy accuracy reduction applies independently of her own 35% dodge, for all nearby allies attacked by them.
  b.on('hit',c=>{
   if(moduleX&&c.source===u&&c.dmg.type==='phys'&&near(u,c.target))c.dmg.mul=(c.dmg.mul??1)*(chess.talents.find(t=>t.index===-1&&t.bb?.atk_scale)?.bb.atk_scale??1.1);
   if(!u.alive||!u.deployed||c.source?.side!=='enemy'||c.target?.side!=='ally')return;
   if(Math.max(Math.abs(c.source.x-u.x),Math.abs(c.source.y-u.y))<=1&&['phys','arts'].includes(c.dmg.type)&&b.rng.chance(-(c.dmg.type==='phys'?t1.damage_hitrate_physical:t1.damage_hitrate_magical)))c.dmg.cancel=true;
  },{owner:u});
 }};
}
