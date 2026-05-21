import { contextBridge, ipcRenderer } from 'electron'
import type { RendererAPI } from '@shared/types'

const api: RendererAPI = {
  supabaseSession: {
    getCurrent: () => ipcRenderer.invoke('supabaseSession:getCurrent'),
    signOut: () => ipcRenderer.invoke('supabaseSession:signOut')
  },
  googleAccounts: {
    list: () => ipcRenderer.invoke('googleAccounts:list'),
    add: () => ipcRenderer.invoke('googleAccounts:add'),
    remove: (email) => ipcRenderer.invoke('googleAccounts:remove', email)
  },
  channels: {
    listFromYoutube: (email) => ipcRenderer.invoke('channels:listFromYoutube', email),
    listRegistered: () => ipcRenderer.invoke('channels:listRegistered'),
    register: (params) => ipcRenderer.invoke('channels:register', params),
    setActive: (id, isActive) => ipcRenderer.invoke('channels:setActive', id, isActive),
    addManual: (params) => ipcRenderer.invoke('channels:addManual', params)
  },
  fetch: {
    runNow: (params) => ipcRenderer.invoke('fetch:runNow', params),
    listRuns: (limit) => ipcRenderer.invoke('fetch:listRuns', limit)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (s) => ipcRenderer.invoke('settings:set', s)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: RendererAPI
  }
}
