import type { FetchRunSummary } from '@shared/types'
import { getDailyMetrics } from './youtube/analytics-api'
import {
  listActiveChannels,
  upsertDailyMetrics,
  createRun,
  finishRun
} from './supabase/repo'
import { getCurrentSupabaseUser } from './supabase/auth'
import { getSupabase } from './supabase/client'

/**
 * 日付ユーティリティ（タイムゾーン非依存、YYYY-MM-DD固定）
 */
function ymd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

/**
 * 日次取得の本体。
 * デフォルトは「今日 - 3日」から「今日 - 1日」までの3日分を upsert する。
 * （Analytics APIは1〜2日遅れて確定するため、再取得で上書きする戦略）
 */
export async function runDailyFetch(opts: {
  trigger: 'cron' | 'manual' | 'resume'
  from?: string
  to?: string
}): Promise<FetchRunSummary> {
  const today = new Date()
  const defaultTo = ymd(addDays(today, -1))
  const defaultFrom = ymd(addDays(today, -3))
  const startDate = opts.from ?? defaultFrom
  const endDate = opts.to ?? defaultTo

  console.log(`[fetcher] trigger=${opts.trigger} range=${startDate}~${endDate}`)

  const channels = await listActiveChannels()
  const { signedIn } = await getCurrentSupabaseUser()
  if (!signedIn) throw new Error('Supabaseにサインインしていません')

  const sb = getSupabase()
  const { data: userData } = await sb.auth.getUser()
  const userId = userData.user?.id ?? null

  const runId = await createRun({
    targetDateFrom: startDate,
    targetDateTo: endDate,
    channelCount: channels.length,
    userId
  })

  let successCount = 0
  let failedCount = 0
  const errors: Array<{ channel: string; error: string }> = []

  for (const ch of channels) {
    if (!ch.owner_email) {
      failedCount++
      errors.push({ channel: ch.channel_title, error: 'owner_email 未設定' })
      continue
    }
    try {
      const rows = await getDailyMetrics({
        accountEmail: ch.owner_email,
        youtubeChannelId: ch.youtube_channel_id,
        startDate,
        endDate
      })
      await upsertDailyMetrics({ channelId: ch.id, rows, userId })
      successCount++
    } catch (e) {
      failedCount++
      const msg = (e as Error).message
      errors.push({ channel: ch.channel_title, error: msg })
      console.error(`[fetcher] ${ch.channel_title} failed:`, msg)
    }
  }

  const status =
    failedCount === 0
      ? 'success'
      : successCount === 0
        ? 'failed'
        : 'partial'

  await finishRun({
    id: runId,
    successCount,
    failedCount,
    status,
    errorSummary: errors.length ? errors.map((e) => `${e.channel}: ${e.error}`).join(' / ') : null,
    details: { errors }
  })

  return {
    id: runId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    targetDateFrom: startDate,
    targetDateTo: endDate,
    channelCount: channels.length,
    successCount,
    failedCount,
    status,
    errorSummary: errors.length ? errors.map((e) => `${e.channel}: ${e.error}`).join(' / ') : null
  }
}
