const { app, BrowserWindow, Menu, dialog, utilityProcess, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const state = path.join(base, 'state');
fs.mkdirSync(state, { recursive: true });
fs.mkdirSync(path.join(state, 'exports'), { recursive: true });
app.setPath('userData', path.join(state, 'profile'));
app.setPath('sessionData', path.join(state, 'profile'));
app.setPath('downloads', path.join(state, 'exports'));
app.setPath('crashDumps', path.join(state, 'crashes'));
let child, game, studio, address, studioAddress, stopping = false, stopped = false;
const logPath = path.join(state, 'desktop.log');
function log(text) { fs.appendFileSync(logPath, `${new Date().toISOString()} ${text}\n`); }
function windowFor(url, title) {
  const win = new BrowserWindow({ title, width: 1440, height: 960, minWidth: 960, minHeight: 640,
    backgroundColor: '#10151b', show: false, icon: path.join(base, 'SP_ico.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  win.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url);
    if (target.origin === new URL(address).origin) {
      if (target.pathname.startsWith('/studio/')) openStudio();
      else if (game && !game.isDestroyed()) { game.loadURL(url); game.focus(); }
    } else if (target.protocol === 'https:' && target.hostname === 'github.com') {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== new URL(address).origin) event.preventDefault();
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(url).catch(error => { log(error.stack); dialog.showErrorBox('页面加载失败', error.message); });
  return win;
}
function openStudio() {
  if (studio && !studio.isDestroyed()) { studio.focus(); return; }
  studio = windowFor(studioAddress, '卫戍协议 · 插件工作台');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (game) { if (game.isMinimized()) game.restore(); game.focus(); } });
  app.whenReady().then(async () => {
    const config = JSON.parse(fs.readFileSync(path.join(base, 'config.json'), 'utf8'));
    config.gameRoot = path.resolve(base, config.gameRoot);
    if (!fs.existsSync(path.join(config.gameRoot, 'server/index.js'))) throw new Error('找不到游戏安装，请修改 config.json 中的 gameRoot。');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('本地服务启动超过 60 秒，请查看日志。')), 60000);
      const diagnostic = process.argv.some(a => path.basename(a) === 'alliance-smoke.cjs');
      child = utilityProcess.fork(path.join(base, 'server-host.mjs'), [config.gameRoot, state, String(config.port), diagnostic ? 'diagnostic' : 'normal'],
        { cwd: base, stdio: 'pipe', serviceName: 'Stronghold Local Server' });
      child.stdout.on('data', b => log(String(b)));
      child.stderr.on('data', b => log(String(b)));
      child.once('exit', code => {
        clearTimeout(timer); stopped = true;
        if (!stopping) { reject(new Error(`本地服务退出 (${code})，端口可能被占用。日志：${logPath}`));
          if (game) { dialog.showErrorBox('本地服务停止', `日志：${logPath}`); app.quit(); } }
      });
      child.once('message', message => {
        if (!message.ready) return;
        clearTimeout(timer); address = message.url; studioAddress = message.studioUrl; resolve();
      });
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '游戏', submenu: [ { label: '回到游戏', click: () => game.loadURL(address) },
        { label: '插件工作台', accelerator: 'Ctrl+Shift+P', click: openStudio },
        { type: 'separator' }, { label: '退出（结束本地对局）', role: 'quit' } ] },
      { label: '工具', submenu: [ { label: '打开插件文件夹', click: () => shell.openPath(path.join(state, path.basename(config.gameRoot) === 'forge' ? 'alliance-plugins' : 'plugins')) },
        { label: '打开盟约合集文件夹', click: () => shell.openPath(path.join(config.gameRoot, 'workshop')) },
        { label: '打开日志文件夹', click: () => shell.openPath(state) },
        { label: '重新加载页面', role: 'reload' }, { label: '全屏', role: 'togglefullscreen' },
        { label: '开发者工具', role: 'toggleDevTools' } ] }
    ]));
    game = windowFor(address, '卫戍协议：盟约 · 本地版');
    game.on('close', () => { if (studio && !studio.isDestroyed()) studio.close(); });
  }).catch(error => { log(error.stack); dialog.showErrorBox('卫戍协议启动失败', `${error.message}\n\n日志：${logPath}`); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (!child || stopped) return;
    event.preventDefault();
    if (stopping) return;
    stopping = true;
    child.once('exit', () => app.quit());
    child.postMessage('stop');
    setTimeout(() => { if (!stopped) child.kill(); }, 5000);
  });
}
