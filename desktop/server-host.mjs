import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, state, port] = process.argv.slice(2);
const temporary = path.join(state, 'tmp');
fs.mkdirSync(temporary, { recursive: true });
process.env.TMP = temporary;
process.env.TEMP = temporary;
// The upstream match host and trial bench use child_process.fork. Their children
// must run the bundled Electron executable as Node, rather than open another app.
if (process.versions.electron) process.env.ELECTRON_RUN_AS_NODE = '1';
fs.mkdirSync(path.join(state, 'plugins'), { recursive: true });
// No inherited production trust or test flags in the desktop runtime.
for (const key of Object.keys(process.env)) {
  if (/^SP_/.test(key)) delete process.env[key];
}
process.env.SP_STUDIO = 'local';
if (process.argv[5] === 'diagnostic') process.env.SP_TEST_MODE = 'local';
const integrated = path.basename(root) === 'forge';
const pluginsDir = path.join(state, integrated ? 'alliance-plugins' : 'plugins');
const { startServer } = await import(pathToFileURL(path.join(root, 'server/index.js')).href);
const srv = await startServer({
  host: '127.0.0.1', port: Number(port),
  pluginsDir,
  assetIndex: { cacheFile: path.join(state, 'asset-hashes.json') },
});
const send = message => process.parentPort ? process.parentPort.postMessage(message) : process.send?.(message);
send({ ready: true, url: srv.url, studioUrl: srv.studio.pageUrl(srv.url) });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await srv.close();
  process.exit(0);
}
if (process.parentPort) process.parentPort.on('message', e => { if (e.data === 'stop') void close(); });
else {
  process.on('message', m => { if (m === 'stop') void close(); });
  process.on('disconnect', () => void close());
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
