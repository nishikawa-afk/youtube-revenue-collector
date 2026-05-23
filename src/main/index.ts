import { app, BrowserWindow, shell, powerMonitor } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { initScheduler } from './scheduler'
import { loadStoredSession } from './supabase/auth'
import { runDailyFetch } from './fetcher'
import {
  startChannelRealtimeSync,
  stopChannelRealtimeSync
} from './supabase/channelRealtimeSync'

const isDev = !app.isPackaged

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'YouTube Revenue Collector',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  await loadStoredSession().catch((e) => console.warn('[main] loadStoredSession:', e))
  initScheduler()

  // ダッシュボードから新規 ch が登録されたとき、自動的に accessible_channel_ids を再同期する
  try {
    startChannelRealtimeSync()
  } catch (e) {
    console.warn('[main] startChannelRealtimeSync:', (e as Error).message)
  }

  const win = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  // スリープ復帰時に欠損日キャッチアップ
  powerMonitor.on('resume', () => {
    win.webContents.send('power:resume')
    runDailyFetch({ trigger: 'resume' }).catch((err) => {
      console.error('[main] resume fetch failed:', err)
    })
  })
})

app.on('window-all-closed', () => {
  stopChannelRealtimeSync()
  if (process.platform !== 'darwin') app.quit()
})
