// Feature tests explicitly use the selected content, never change the on-disk vanilla tables.
import {createPluginRegistry} from '../../server/plugins/registry.js';
import {buildContentSet} from '../../server/plugins/contentSet.js';
import {setData} from '../../server/data.js';
const registry=createPluginRegistry({pluginsDir:'plugins',dataDir:'data',publicDir:'public',simDir:'server/sim',sharedDir:'shared'});
const ids=(process.env.SP_TEST_FEATURES ? process.env.SP_TEST_FEATURES.split(',') : ['rounds','factions','relics','operators','damage','lucky','recruits','targeted']).map(k=>'lele-'+k);
const set=buildContentSet({registry,ids});
if(set.problems?.length)throw new Error(JSON.stringify(set.problems));
setData(set.data);

const {setSimData}=await import('../../server/sim/simdata.js');
const {setGameData}=await import('../../server/sim/content/support/index.js');
setSimData(set.data);setGameData(set.data);
