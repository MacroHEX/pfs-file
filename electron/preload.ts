import {contextBridge, ipcRenderer} from 'electron'
import OpenDialogOptions = Electron.OpenDialogOptions;

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Opens a file selection dialog and returns the first selected file path, or null if canceled.
  selectFile: async (options: OpenDialogOptions = {properties: ['openFile']}) => {
    const result = await ipcRenderer.invoke('dialog:openFile', options);
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  },
  // Opens a directory selection dialog and returns the first selected directory path, or null if canceled.
  selectOutputDir: async (options: OpenDialogOptions = {properties: ['openDirectory']}) => {
    const result = await ipcRenderer.invoke('dialog:openDirectory', options);
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  },
  // Triggers file extraction in the main process.
  extractFiles: async (filePath: string, outputDir: string) => {
    return await ipcRenderer.invoke('files:extract', filePath, outputDir);
  }
})
