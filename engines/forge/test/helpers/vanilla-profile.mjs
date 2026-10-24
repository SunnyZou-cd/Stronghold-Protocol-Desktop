// Preload the isolated official data before any test imports the shared singleton.
import { getData } from '../../server/data.js';
import { fileURLToPath } from 'node:url';
getData({ dir: fileURLToPath(new URL('../../data/vanilla/', import.meta.url)), log: { info(){}, warn(){}, error(){} } });
