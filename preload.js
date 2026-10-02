const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('peregrin', {
  // Opens a native folder-only dialog; resolves to the absolute path or null.
  pickDirectory: (defaultPath) => ipcRenderer.invoke('dialog:pickDirectory', defaultPath),
})
