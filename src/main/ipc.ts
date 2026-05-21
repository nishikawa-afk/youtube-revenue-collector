import { ipcMain } from 'electron'
import { runDailyFetch } from './fetcher'
import { getSettings, setSettings } from './settings'
import { scheduleAt } from './scheduler'
import {
  startAddAccountFlow,
  listAccounts as listAuthAccounts,
  removeAccount as removeAuthAccount
} from './auth/google-oauth'
import {
  listAccountMeta,
  removeAccountMeta,
  upsertAccountMeta
} from './auth/account-store'
import { listMyChannels } from './youtube/data-api'
import {
  listChannels,
  registerChannel,
  setChannelActive,
  listRuns
} from './supabase/repo'
import { getCurrentSupabaseUser, signOutSupabase } from './supabase/auth'
import { startAddAccountFlowAndSignIn } from './auth/sign-in-with-google'

export function registerIpcHandlers(): void {
  // ---- Supabase session ----
  ipcMain.handle('supabaseSession:getCurrent', async () => getCurrentSupabaseUser())
  ipcMain.handle('supabaseSession:signOut', async () => signOutSupabase())

  // ---- Google accounts ----
  ipcMain.handle('googleAccounts:list', async () => {
    const emails = await listAuthAccounts()
    return listAccountMeta(emails)
  })
  ipcMain.handle('googleAccounts:add', async () => {
    const result = await startAddAccountFlowAndSignIn()
    upsertAccountMeta(result.email, result.displayName)
    const [meta] = listAccountMeta([result.email])
    return meta
  })
  ipcMain.handle('googleAccounts:remove', async (_e, email: string) => {
    await removeAuthAccount(email)
    removeAccountMeta(email)
  })

  // ---- Channels ----
  ipcMain.handle('channels:listFromYoutube', async (_e, accountEmail: string) => {
    return listMyChannels(accountEmail)
  })
  ipcMain.handle('channels:listRegistered', async () => listChannels())
  ipcMain.handle(
    'channels:register',
    async (
      _e,
      params: {
        youtubeChannelId: string
        channelTitle: string
        ownerEmail: string
        caseId?: string | null
      }
    ) => registerChannel(params)
  )
  ipcMain.handle('channels:setActive', async (_e, id: string, isActive: boolean) =>
    setChannelActive(id, isActive)
  )

  // ---- Fetch ----
  ipcMain.handle('fetch:runNow', async (_e, params: { from?: string; to?: string }) => {
    return runDailyFetch({ trigger: 'manual', from: params?.from, to: params?.to })
  })
  ipcMain.handle('fetch:listRuns', async (_e, limit?: number) => listRuns(limit ?? 20))

  // ---- Settings ----
  ipcMain.handle('settings:get', async () => getSettings())
  ipcMain.handle(
    'settings:set',
    async (_e, patch: { cronTime?: string; timezone?: string }) => {
      setSettings(patch)
      const s = getSettings()
      scheduleAt(s.cronTime, s.timezone)
    }
  )
}
