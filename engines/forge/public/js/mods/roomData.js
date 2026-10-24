import { roomDataBase, DATA_PREFIX } from './align.js';

export const ROOM_VIEW_FILES = ['config', 'chess', 'bonds', 'garrisons', 'items', 'bands', 'effects', 'choices', 'enemies', 'factions', 'waves', 'stages', 'bosses', 'tokens', 'assets', 'backups'];

export function createRoomDataSync({ data, fetch: doFetch = (...a) => globalThis.fetch(...a), files = ROOM_VIEW_FILES, onError = console.error }) {
  let current = '', sequence = 0, pending = Promise.resolve();
  return function sync(mods, welcome) {
    const base = roomDataBase(mods, welcome);
    if (base === current) return pending;
    current = base; const mine = ++sequence;
    if (base === DATA_PREFIX) { data.setRoomContent(null); pending = Promise.resolve(); return pending; }
    pending = Promise.all(files.map(async name => {
      const response = await doFetch(base + name + '.json', { cache: 'no-cache' });
      if (!response.ok) throw Error(`Room data ${name}: HTTP ${response.status}`);
      return [name, await response.json()];
    })).then(values => {
      if (mine === sequence) data.setRoomContent({ id: `room:${mods.digest}`, values: new Map(values) });
    }).catch(error => { if (mine === sequence) { current = ''; onError(error); } });
    return pending;
  };
}
