// OAuth refresh_token を Supabase の youtube_oauth_tokens に upsert する。
// Coach がリアルタイムで Analytics API を直接叩くためのデータソース。
//
// セキュリティ:
//   - Collector の Supabase 認証セッションで書き込み (anon key)
//   - RLS で「自分の email == google_email」の行だけ upsert 可能
//   - SELECT は禁止、サーバーサイド (service_role) からのみ読める

import { getSupabase } from './client'

const SCOPES_TRACKED = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
]

export async function syncRefreshTokenToSupabase(params: {
  email: string
  refreshToken: string
  accessibleChannelIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabase()
    // 認証セッションが必要 (signInWithGoogleIdToken 済みでないと RLS に弾かれる)
    const { error } = await sb.from('youtube_oauth_tokens').upsert(
      {
        google_email: params.email,
        refresh_token: params.refreshToken,
        scopes: SCOPES_TRACKED,
        accessible_channel_ids: params.accessibleChannelIds
      },
      { onConflict: 'google_email' }
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
