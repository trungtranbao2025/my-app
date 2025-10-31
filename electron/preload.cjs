const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Có thể thêm các API tùy chỉnh ở đây nếu cần
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  hardReload: () => ipcRenderer.invoke('app:hard-reload')
})

// Log để debug
console.log('Preload script loaded successfully')
