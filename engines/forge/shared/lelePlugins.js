// Compatibility surface for the split Lele plugins. No room state or ambient I/O.
export const LELE_HOST_API = 1;
export const LELE_FEATURES = Object.freeze(['rounds','factions','operators','recruits','relics','damage','lucky','targeted']);
export const LELE_FLAGS = Object.freeze({rounds:'doubleRounds',factions:'rhineEnabled',operators:'operatorsEnabled',recruits:'recruitsEnabled',relics:'relicsEnabled',damage:'damageEnabled',lucky:'luckyEnabled',targeted:'targetedEnabled'});
const clone=v=>JSON.parse(JSON.stringify(v));
const safe=k=>typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k);
export function applyLelePackages(input, selected){
 const host=input.config?.economy?.leleHost;
 if(!host)return input;
 if(host.api!==LELE_HOST_API)throw new Error('Incompatible Lele host API');
 const chosen=new Set(selected.map(p=>typeof p==='string'?p:p.id));
 const packages=host.packages||{},enabled={};let output=null;
 for(const feature of LELE_FEATURES){
  const payload=packages[feature];
  if(!payload?.api)continue;
  if(!chosen.has('lele-'+feature)||payload.api!==LELE_HOST_API||payload.feature!==feature||payload.flag!==LELE_FLAGS[feature]||!Array.isArray(payload.changes))throw new Error('Invalid Lele plugin payload: '+feature);
  output||=clone(input);enabled[feature]=true;
  for(const edit of payload.changes){
   if(!Array.isArray(edit.path)||!edit.path.length||!edit.path.every(safe)||!['chess','bonds','garrisons','tokens','effects','config','items','backups','choices','factions'].includes(edit.path[0])||edit.path.includes('leleHost'))throw new Error('Invalid feature edit path: '+feature);
   let target=output;
   for(const key of edit.path.slice(0,-1)){
    if(!target[key]||typeof target[key]!=='object'||Array.isArray(target[key]))throw new Error('Missing feature edit parent: '+edit.path.join('.'));
    target=target[key];
   }
   const key=edit.path.at(-1);
   if(edit.remove){delete target[key];continue;}
   if(edit.append){
    if(!Array.isArray(target[key])||!Array.isArray(edit.append))throw new Error('Invalid feature append');
    const known=new Set(target[key].map(v=>JSON.stringify(v)));
    target[key].push(...clone(edit.append.filter(v=>!known.has(JSON.stringify(v)))));
   }else target[key]=clone(edit.value);
  }
 }
 if(!output)return input;
 // The Rhine Wisdel owns the slot when both faction and extra-recruit plugins are selected.
 if(enabled.factions&&enabled.recruits){
  const duplicates=new Set(Object.entries(output.chess).filter(([id,c])=>id.startsWith('chess_custom_')&&Object.values(output.chess).some(k=>k.baseId?.startsWith('chess_kazdel_')&&k.charId===c.charId)).map(([id])=>id));
  for(const id of duplicates)delete output.chess[id];
  for(const [id,g]of Object.entries(output.garrisons))if(g.owners?.length&&g.owners.every(owner=>duplicates.has(owner)))delete output.garrisons[id];
  for(const token of Object.values(output.tokens)){
   if(token.owners)token.owners=token.owners.filter(id=>!duplicates.has(id));
   if(token.variants)for(const id of duplicates)delete token.variants[id];
  }
  for(const b of Object.values(output.bonds))for(const key of ['members','visibleMembers','chessIds'])if(Array.isArray(b[key]))b[key]=b[key].filter(v=>!duplicates.has(typeof v==='string'?v:v.chessId));
 }
 // Keep only the small activation record in match data. Plugin bytes remain in the content hash.
 output.config.economy.leleHost={api:LELE_HOST_API,enabled,packages:Object.fromEntries(LELE_FEATURES.map(k=>[k,{}]))};
 return output;
}
export function leleFlags(data){
 const enabled=data?.config?.economy?.leleHost?.enabled||{};
 return Object.fromEntries(Object.entries(LELE_FLAGS).map(([k,v])=>[v,enabled[k]===true]));
}
