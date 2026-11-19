// Capy PDF - Electron 主程式
const { app, BrowserWindow, shell, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 改名後沿用舊版（InkDesk PDF）的設定與工具列位置
// 攜帶版：設定、印章、匯入的字型都存在 exe 旁邊的「Capy PDF 資料」資料夾，跟著隨身碟走
const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || '';
if (PORTABLE_DIR) {
  try { const d = path.join(PORTABLE_DIR, 'Capy PDF 資料'); fs.mkdirSync(d, { recursive: true }); app.setPath('userData', d); } catch (e) { }
} else try {
  const appData = app.getPath('appData'), newDir = path.join(appData, 'Capy PDF');
  if (!fs.existsSync(newDir)) {
    for (const old of ['InkDesk PDF', 'inkdesk-pdf']) {
      const od = path.join(appData, old);
      if (fs.existsSync(od)) { fs.cpSync(od, newDir, { recursive: true, errorOnExist: false, force: false }); break; }
    }
  }
  app.setPath('userData', newDir);
} catch (e) { }
let win = null;
let allowClose = false;
// 記住視窗大小、位置與是否最大化
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return null; } }
function saveState() {
  try {
    if (!win || win.isDestroyed()) return;
    const s = { bounds: win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds(), maximized: win.isMaximized(), fullscreen: win.isFullScreen() };
    fs.writeFileSync(stateFile(), JSON.stringify(s));
  } catch (e) { }
}
const isMac = process.platform === 'darwin';
// macOS：從 Finder「打開方式」或拖到 Dock 圖示的 PDF
let loaded = false; const pendingFiles = [];
app.on('open-file', (e, f) => { e.preventDefault(); if (win && loaded) { if (win.isMinimized()) win.restore(); win.focus(); sendFiles([f]); } else pendingFiles.push(f); });
function macMenu() {
  const send = c => () => { if (win) win.webContents.send('menu-cmd', c); };
  const both = (native, c) => (_m, w) => { const wc = (w || win).webContents; try { wc[native](); } catch (e) { } wc.send('menu-cmd', c); };
  const sep = { type: 'separator' };
  return Menu.buildFromTemplate([
    { label: 'Capy PDF', submenu: [{ role: 'about', label: '關於 Capy PDF' }, sep, { role: 'hide', label: '隱藏 Capy PDF' }, { role: 'hideOthers', label: '隱藏其他' }, { role: 'unhide', label: '顯示全部' }, sep, { role: 'quit', label: '結束 Capy PDF' }] },
    { label: '檔案', submenu: [{ label: '開啟…', accelerator: 'CmdOrCtrl+O', click: send('open') }, { label: '儲存', accelerator: 'CmdOrCtrl+S', click: send('save') }, { label: '另存新檔…', accelerator: 'Shift+CmdOrCtrl+S', click: send('saveas') }, { label: '匯出 PDF／Word…', accelerator: 'CmdOrCtrl+E', click: send('export') }, sep, { role: 'close', label: '關閉視窗' }] },
    { label: '編輯', submenu: [{ label: '復原', accelerator: 'CmdOrCtrl+Z', click: both('undo', 'undo') }, { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', click: both('redo', 'redo') }, sep, { label: '剪下', accelerator: 'CmdOrCtrl+X', click: both('cut', 'cut') }, { label: '拷貝', accelerator: 'CmdOrCtrl+C', click: both('copy', 'copy') }, { label: '貼上', accelerator: 'CmdOrCtrl+V', click: both('paste', 'paste') }, { label: '全選', accelerator: 'CmdOrCtrl+A', click: both('selectAll', 'selectall') }, sep, { label: '尋找', accelerator: 'CmdOrCtrl+F', click: send('find') }, { label: '尋找並取代', accelerator: 'Alt+CmdOrCtrl+F', click: send('replace') }] },
    { label: '顯示方式', submenu: [{ label: '放大', accelerator: 'CmdOrCtrl+=', click: send('zoomin') }, { label: '縮小', accelerator: 'CmdOrCtrl+-', click: send('zoomout') }, { label: '實際大小', accelerator: 'CmdOrCtrl+0', click: send('zoom100') }, sep, { role: 'togglefullscreen', label: '進入／結束全螢幕' }] },
    { role: 'windowMenu', label: '視窗' },
    { role: 'help', label: '說明', submenu: [{ label: '快捷鍵一覽', click: send('help') }] }
  ]);
}
const pdfArgs = argv => argv.slice(1).filter(a => /\.pdf$/i.test(a) && fs.existsSync(a));

function sendFiles(files) {
  for (const f of files) {
    try { win.webContents.send('open-file', { name: path.basename(f), data: fs.readFileSync(f), path: f }); }
    catch (e) { console.error('無法讀取', f, e); }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // 已開啟時再用 Capy 開 PDF：在原視窗開新分頁
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    sendFiles(pdfArgs(argv));
  });

  // 開啟／儲存／另存新檔（給網頁端呼叫）
  ipcMain.handle('open-pdf', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] });
    if (r.canceled) return [];
    return r.filePaths.map(p => ({ name: path.basename(p), data: fs.readFileSync(p), path: p }));
  });
  ipcMain.handle('read-font', async (_e, n) => { if (!/^seal\d+\.woff$/.test(String(n))) return null; try { return fs.readFileSync(path.join(__dirname, 'app', 'fonts', n)); } catch (e) { return null; } });
  ipcMain.handle('save-pdf', async (_e, p, data) => { fs.writeFileSync(p, Buffer.from(data)); return true; });
  ipcMain.handle('save-as', async (_e, name, data) => {
    const ext = String(name).split('.').pop().toLowerCase();
    const F = ext === 'docx' ? { name: 'Word 文件', extensions: ['docx'] } : { name: 'PDF 文件', extensions: ['pdf'] };
    const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [F] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, Buffer.from(data));
    return r.filePath;
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(isMac ? macMenu() : null);
    const st = loadState();
    const { screen } = require('electron');
    let b = st && st.bounds;
    if (b) { const vis = screen.getAllDisplays().some(d => { const a = d.workArea; return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y < a.y + a.height - 60 && b.y + b.height > a.y + 20; }); if (!vis) b = null; }
    win = new BrowserWindow({
      width: b ? b.width : 1400, height: b ? b.height : 900, x: b ? b.x : undefined, y: b ? b.y : undefined, minWidth: 900, minHeight: 600,
      backgroundColor: '#18181b', title: 'Capy PDF V8.1' + (PORTABLE_DIR ? ' 攜帶版' : ''),
      icon: path.join(__dirname, 'build', 'icon.png'),
      autoHideMenuBar: true, show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
    });
    win.once('ready-to-show', () => { if (!st || st.maximized) win.maximize(); if (st && st.fullscreen) win.setFullScreen(true); win.show(); });
    let stT = 0; const queueState = () => { clearTimeout(stT); stT = setTimeout(saveState, 500); };
    win.on('resize', queueState); win.on('move', queueState); win.on('maximize', queueState); win.on('unmaximize', queueState);

    // 關閉視窗：先交給程式畫面詢問（可選擇儲存）
    let ackT = 0;
    win.on('close', e => {
      saveState();
      if (allowClose) return;
      e.preventDefault();
      win.webContents.send('close-request');
      clearTimeout(ackT);
      ackT = setTimeout(() => {   // 畫面沒有回應時的備援
        const c = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['關閉', '取消'], defaultId: 1, cancelId: 1, title: 'Capy PDF V8.1' + (PORTABLE_DIR ? ' 攜帶版' : ''), message: '程式沒有回應，確定要關閉嗎？未儲存的變更會遺失。' });
        if (c === 0) { allowClose = true; win.close(); }
      }, 2500);
    });
    ipcMain.on('close-ack', () => clearTimeout(ackT));
    ipcMain.on('close-ok', () => { clearTimeout(ackT); allowClose = true; saveState(); if (win && !win.isDestroyed()) win.close(); });
    win.loadFile(path.join(__dirname, 'app', 'index.html'));

    // 從檔案總管「開啟檔案」或拖到捷徑上的 PDF
    win.webContents.once('did-finish-load', () => { loaded = true; sendFiles(isMac ? pendingFiles.splice(0) : pdfArgs(process.argv)); });

    // 外部連結用預設瀏覽器開
    win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });

    // 有未匯出的標註時，關閉前詢問
    win.webContents.on('will-prevent-unload', e => {
      if (allowClose) { e.preventDefault(); return; }
      const c = dialog.showMessageBoxSync(win, {
        type: 'warning', buttons: ['不儲存並關閉', '取消'], defaultId: 1, cancelId: 1,
        title: 'Capy PDF V8.1' + (PORTABLE_DIR ? ' 攜帶版' : ''), message: '有文件的標註還沒匯出成 PDF，確定要關閉嗎？'
      });
      if (c === 0) e.preventDefault();
    });

    // 開發時可按 F12 開除錯工具
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
