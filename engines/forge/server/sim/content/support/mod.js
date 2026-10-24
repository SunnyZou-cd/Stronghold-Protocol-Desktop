// Pack-facing registration API ported from IncogniBox/stronghold-protocol-forge-full.
// Local port: expose only the APIs consumed by the audited Columbia / Ave Mujica packs.
export * from './index.js';
export { registerBondInstaller, reached, onLayers, onUnitDamaged, isEnemyTarget, ownTag, bondBb } from '../bonds/core.js';
export { registerGarrisonInstaller } from '../garrisons/battle.js';
export { addShieldLayer } from '../items/battle.js';
export { registerItemBehaviour } from '../items/battle.js';
