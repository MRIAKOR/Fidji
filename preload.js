const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fidji', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),
  addImages: () => ipcRenderer.invoke('image:add'),
  getImagesBase: () => ipcRenderer.invoke('image:getBase'),
  openTextFile: () => ipcRenderer.invoke('file:openText'),
  auth: {
    getStatus: () => ipcRenderer.invoke('auth:getStatus'),
    setPassword: (pw) => ipcRenderer.invoke('auth:setPassword', pw),
    skipSetup: () => ipcRenderer.invoke('auth:skipSetup'),
    removePassword: () => ipcRenderer.invoke('auth:removePassword'),
    verify: (pw) => ipcRenderer.invoke('auth:verify', pw)
  },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close')
  }
});