import { contextBridge, ipcRenderer } from 'electron'
import type { GymApi, SearchProgress } from '../shared/types'

const api: GymApi = {
  getFacilities: () => ipcRenderer.invoke('gym:get-facilities'),
  search: (criteria) => ipcRenderer.invoke('gym:search', criteria),
  cancelSearch: () => ipcRenderer.invoke('gym:cancel'),
  onProgress: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, progress: SearchProgress): void => listener(progress)
    ipcRenderer.on('gym:progress', wrapped)
    return () => ipcRenderer.removeListener('gym:progress', wrapped)
  }
}

contextBridge.exposeInMainWorld('gymApi', api)
