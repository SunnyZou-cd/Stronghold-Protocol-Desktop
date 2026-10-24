import {customModules,defaultModule} from './modules.mjs';
// Additional six-tier cards, pinned to the official data snapshot.
import { readFileSync } from 'node:fs';
export const EXTRA_OPERATORS = [
  { charId: 'char_1015_aglna2', baseId: 'chess_char_6_aglna2_a', bondId: 'siracusaShip', branch: '巡空者' },
  { charId: 'char_4182_oblvns', baseId: 'chess_char_6_oblvns_a', bondId: 'emptyShip', branch: '领主' },
];
export function buildExtraOperators(buildChess) {
  const official = JSON.parse(readFileSync(new URL('./operators-official.json', import.meta.url), 'utf8'));
  const act = { charChessDataDict: {}, chessNormalIdLookupDict: {}, charShopChessDatas: {}, shopCharChessInfoData: {
    6: [{ isGolden: false, purchasePrice: 4, chessSoldPrice: 1 }, { isGolden: true, purchasePrice: 4, chessSoldPrice: 1 }],
  } };
  const subProfDict = {};
  EXTRA_OPERATORS.forEach(({charId,baseId,bondId,branch}, i) => {
    const goldenId = baseId.replace(/_a$/, '_b');
    act.charShopChessDatas[baseId] = { charId, chessLevel: 6, goldenChessId: goldenId,
      defaultUniEquipId:defaultModule(charId), chessType: 'NORMAL', shopLevelSortId: 25+i, defaultSkillIndex: 2 };
    subProfDict[official.charTable[charId].subProfessionId] = { subProfessionName: branch };
    for (const [id, gold] of [[baseId, false], [goldenId, true]]) {
      act.chessNormalIdLookupDict[id] = baseId;
      act.charChessDataDict[id] = { isGolden: gold, identifier: 10010+i*2+Number(gold),
        bondIds: [bondId], garrisonIds: [], upgradeNum: gold ? 0 : 3, upgradeChessId: gold ? null : goldenId,
        status: { evolvePhase: 'PHASE_2', charLevel: gold ? 60 : 1, skillLevel: gold ? 7 : 4, equipLevel: gold && defaultModule(charId) ? 3 : 0 } };
    }
  });
  const ctx = { ...official, act, ac: {}, uniequip: {...customModules.uniequip,subProfDict}, battleEquip: customModules.battleEquip, research: {} };
  const chess = buildChess(ctx).chess;
  // The S3 token is a client movement helper, not a placeable summon in this grid adaptation.
  for (const c of Object.values(chess)) if (c.charId === 'char_1015_aglna2') {
    for (const s of c.skills) s.overrideTokenKey = null;
    c.skill.overrideTokenKey = null;
  }
  return chess;
}
