import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    send: (channel: string, args: unknown) => {
      ipcRenderer.send(channel, args);
    },
    invoke: (channel: string, args?: unknown) => {
      return ipcRenderer.invoke(channel, args);
    },
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, callback);
    },
    once: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      ipcRenderer.once(channel, callback);
    },
  },
});
