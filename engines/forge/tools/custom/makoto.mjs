import {customModules,defaultModule} from './modules.mjs';
// Custom pool entry; official source snapshot is pinned so rebuilding is reproducible.
import { readFileSync } from 'node:fs';
export const MAKOTO_BASE = 'chess_char_5_makoto_a';
export function buildMakoto(buildChess) {
  const official = JSON.parse(readFileSync(new URL('./makoto-official.json', import.meta.url), 'utf8'));
  const act = { charChessDataDict: {}, chessNormalIdLookupDict: {}, charShopChessDatas: {}, shopCharChessInfoData: {
    5: [{ isGolden: false, purchasePrice: 4, chessSoldPrice: 1 }, { isGolden: true, purchasePrice: 4, chessSoldPrice: 1 }],
  } };
  const goldenId = MAKOTO_BASE.replace(/_a$/, '_b');
  act.charShopChessDatas[MAKOTO_BASE] = { charId: 'char_4217_makoto', chessLevel: 5, goldenChessId: goldenId,
    defaultUniEquipId:defaultModule('char_4217_makoto'), chessType: 'NORMAL', shopLevelSortId: 24, defaultSkillIndex: 2 };
  for (const [id, gold] of [[MAKOTO_BASE, false], [goldenId, true]]) {
    act.chessNormalIdLookupDict[id] = MAKOTO_BASE;
    act.charChessDataDict[id] = { isGolden: gold, identifier: gold ? 10002 : 10001,
      bondIds: ['lateranoShip', 'indomShip'], garrisonIds: [`garrison_makoto_${gold ? 'b' : 'a'}`],
      upgradeNum: gold ? 0 : 3, upgradeChessId: gold ? null : goldenId,
      status: { evolvePhase: 'PHASE_2', charLevel: gold ? 60 : 1, skillLevel: gold ? 7 : 4, equipLevel: gold && defaultModule('char_4217_makoto') ? 3 : 0 } };
  }
  const ctx = { ...official, act, ac: {}, uniequip: { ...customModules.uniequip, subProfDict: { dollkeeper: { subProfessionName: '傀儡师' } } },
    battleEquip: customModules.battleEquip, research: {} };
  const { chess } = buildChess(ctx);
  const garrisons = {};
  for (const c of Object.values(chess)) {
    const n = c.isGolden ? 6 : 3, id = c.garrisonIds[0];
    const desc = `<战斗中>自身被击倒或替身与本体进行切换时，使已激活的【拉特兰】层数+${n}、【不屈】层数+${n}`;
    garrisons[id] = { garrisonId: id, desc, descRaw: desc, eventType: 'IN_BATTLE', eventTypeDesc: '持续叠加',
      eventTypeIcon: 'icon_bond', effectType: 'ADD_BOND', effectKey: 'act1autochess_gar_event_selfdead',
      battleRuneKey: 'env_gbuff_new_with_verify', charLevel: 0, bb: { bond_add_count: n },
      bbStr: { key: 'act1autochess_gar_event_selfdead', bond_type: 'bond_by_id', bond_id: 'lateranoShip,indomShip', bond_add_type: 'by_count' },
      owners: [c.chessId] };
  }
  return { chess, garrisons };
}
