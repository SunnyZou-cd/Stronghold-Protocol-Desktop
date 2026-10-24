import {customModules,defaultModule} from './modules.mjs';
import {readFileSync} from 'node:fs';
export const NARANT_BASE='chess_char_5_narant_a';
export function buildNarant(buildChess){
 const official=JSON.parse(readFileSync(new URL('./narant-official.json',import.meta.url)));
 const goldenId=NARANT_BASE.replace(/_a$/,'_b');
 const act={charChessDataDict:{},chessNormalIdLookupDict:{},charShopChessDatas:{
  [NARANT_BASE]:{charId:'char_4138_narant',chessLevel:5,goldenChessId:goldenId,defaultUniEquipId:defaultModule('char_4138_narant'),chessType:'NORMAL',shopLevelSortId:27,defaultSkillIndex:2}},
  shopCharChessInfoData:{5:[{isGolden:false,purchasePrice:4,chessSoldPrice:1},{isGolden:true,purchasePrice:4,chessSoldPrice:1}]}};
 const garrisons={};
 for(const [id,gold]of [[NARANT_BASE,false],[goldenId,true]]){
  const gid=`garrison_narant_${gold?'b':'a'}`,n=gold?2:1,desc=`【萨尔贡】每叠加8层，本干员攻击力+${n}%`;
  act.chessNormalIdLookupDict[id]=NARANT_BASE;
  act.charChessDataDict[id]={isGolden:gold,identifier:10020+Number(gold),bondIds:['sargonShip'],garrisonIds:[gid],upgradeNum:gold?0:3,upgradeChessId:gold?null:goldenId,
   status:{evolvePhase:'PHASE_2',charLevel:gold?60:1,skillLevel:gold?7:4,equipLevel:gold&&defaultModule('char_4138_narant')?3:0}};
  garrisons[gid]={garrisonId:gid,desc,descRaw:desc,eventType:'IN_BATTLE',eventTypeDesc:'作战能力',eventTypeIcon:'icon_battle',effectType:'GAIN_BUFF',
   effectKey:'act1autochess_gar_eff_attrByBond',battleRuneKey:'env_gbuff_new_with_verify',charLevel:0,bb:{divide_num:8,atk:n/100},
   bbStr:{key:'act1autochess_gar_eff_attrByBond',bond_id:'sargonShip'},owners:[id]};
 }
 const ctx={...official,act,ac:{},uniequip:{...customModules.uniequip,subProfDict:{loopshooter:{subProfessionName:'回环射手'}}},battleEquip:customModules.battleEquip,research:{}};
 return {chess:buildChess(ctx).chess,garrisons};
}
