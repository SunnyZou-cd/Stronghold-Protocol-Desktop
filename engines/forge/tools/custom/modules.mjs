import {readFileSync} from 'node:fs';
export const customModules=JSON.parse(readFileSync(new URL('./modules-official.json',import.meta.url)));
export const defaultModule=charId=>(customModules.uniequip.charEquip[charId]??[]).find(id=>customModules.uniequip.equipDict[id]?.type==='ADVANCED')??null;
