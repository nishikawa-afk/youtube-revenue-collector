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
import { listMyChannels, fetchChannelById, resolveChannelIdFromInput } from './youtube/data-api'
import { verifyChannelAccess } from './youtube/analytics-api'
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

  // Studio Manager 経由のチャンネルを手動追加 (URL or ID を受け取り、検証→登録)
  ipcMain.handle(
    'channels:addManual',
    async (_e, params: { accountEmail: string; input: string; caseId?: string | null }) => {
      // 1. URL/ID → channel ID 解決
      const channelId = await resolveChannelIdFromInput(params.accountEmail, params.input)
      if (!channelId) {
        return { ok: false, error: 'チャンネル URL/ID を解決できませんでした。URL を確認してください。' }
      }
      // 2. analytics 権限の事前検証
      const access = await verifyChannelAccess(params.accountEmail, channelId)
      if (!access.ok) {
        if (access.status === 403) {
          return {
            ok: false,
            error: `このアカウント (${params.accountEmail}) に Analytics 権限がありません。YouTube Studio で Manager 権限を付与してもらってください。`
          }
        }
        if (access.status === 404) {
          return { ok: false, error: `チャンネル ${channelId} が見つかりません。` }
        }
        return { ok: false, error: `Analytics アクセス検証失敗: ${access.reason}` }
      }
      // 3. チャンネル詳細取得
      const detail = await fetchChannelById(params.accountEmail, channelId)
      if (!detail) {
        return { ok: false, error: 'チャンネル詳細を取得できませんでした。' }
      }
      // 4. Supabase + ローカルに登録
      const ch = await registerChannel({
        youtubeChannelId: detail.id,
        channelTitle: detail.title,
        ownerEmail: params.accountEmail,
        caseId: params.caseId ?? null
      })
      return { ok: true, channel: ch }
    }
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
