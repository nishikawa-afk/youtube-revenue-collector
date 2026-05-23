// ダッシュボードで新規 YouTube チャンネルが登録されたとき、
// Collector 側で自動的に accessible_channel_ids を再同期する。
//
// 流れ:
//   1) 起動時に supabase_realtime の youtube_channels INSERT を subscribe
//   2) INSERT イベント発火 → ローカルに保存されてる全 OAuth アカウントを順に
//      listMyChannels で叩き直し、各 email の accessible_channel_ids を更新
//   3) これでダッシュボードから手動追加 → Collector が即座に新 ch を認識し、
//      日次フェッチ対象に含めるようになる
//
// セキュリティ:
//   - RLS により upsert は「自分の google_email」の行だけ可
//   - listMyChannels で実際にそのアカウントが owner の ch のみ accessible_channel_ids に入る
//   - 他人が登録した ch でも、自分のアカウントが owner じゃなければ accessible_channel_ids には入らない
//     → アカウント紐付けリスク無し

import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from './client'
import { listAccounts } from '../auth/google-oauth'
import { listMyChannels } from '../youtube/data-api'
import { updateAccessibleChannelIdsForEmail } from './oauthSync'

let channel: RealtimeChannel | null = null

export function startChannelRealtimeSync(): void {
  if (channel) return // 既に起動済み
  const sb = getSupabase()
  channel = sb
    .channel('public:youtube_channels:insert')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'youtube_channels' },
      async (payload) => {
        const newCh = payload.new as {
          youtube_channel_id?: string
          channel_title?: string
        }
        console.log(
          `[realtime] new ch detected: ${newCh.channel_title} (${newCh.youtube_channel_id}) — re-syncing all local accounts`
        )
        await syncAllAccountsAccessibleChannels().catch((e) =>
          console.warn('[realtime] resync failed:', (e as Error).message)
        )
      }
    )
    .subscribe((status) => {
      console.log('[realtime] youtube_channels subscription status:', status)
    })
}

export function stopChannelRealtimeSync(): void {
  if (channel) {
    const sb = getSupabase()
    sb.removeChannel(channel)
    channel = null
  }
}

/**
 * ローカルに保存されてる全 OAuth アカウントについて、
 * listMyChannels で最新の所有チャンネル一覧を取得し、
 * Supabase 上の accessible_channel_ids を更新する。
 *
 * best-effort: 1 アカウントの失敗で他は止めない。
 */
export async function syncAllAccountsAccessibleChannels(): Promise<{
  total: number
  ok: number
  failed: number
}> {
  const emails = await listAccounts()
  let ok = 0
  let failed = 0
  for (const email of emails) {
    try {
      const chs = await listMyChannels(email)
      const result = await updateAccessibleChannelIdsForEmail(
        email,
        chs.map((c) => c.id)
      )
      if (result.ok) {
        ok += 1
        console.log(
          `[realtime] updated ${email}: ${chs.length} accessible channels`
        )
      } else {
        failed += 1
        console.warn(`[realtime] update failed for ${email}:`, result.error)
      }
    } catch (e) {
      failed += 1
      console.warn(`[realtime] sync error for ${email}:`, (e as Error).message)
    }
  }
  return { total: emails.length, ok, failed }
}
