// 讓網頁端可以開啟、儲存、另存 PDF，並接收「用 Capy PDF 開啟」的檔案
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('inkdeskHost', {
  isDesktop: true,
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, f) => cb(f.name, f.data, f.path)),
  openPdf: () => ipcRenderer.invoke('open-pdf'),
  savePdf: (p, data) => ipcRenderer.invoke('save-pdf', p, data),
  saveAs: (name, data) => ipcRenderer.invoke('save-as', name, data),
  onCloseRequest: cb => ipcRenderer.on('close-request', () => cb()),
  closeAck: () => ipcRenderer.send('close-ack'),
  closeOk: () => ipcRenderer.send('close-ok'),
  isMac: process.platform === 'darwin',
  onMenuCmd: cb => ipcRenderer.on('menu-cmd', (_e, c) => cb(c)),
  readFont: n => ipcRenderer.invoke('read-font', n),
  getPath: f => { try { return webUtils.getPathForFile(f); } catch (e) { return null; } }
});
