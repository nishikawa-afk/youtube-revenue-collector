// OAuth refresh_token を Supabase の youtube_oauth_tokens に upsert する。
// Coach がリアルタイムで Analytics API を直接叩くためのデータソース。
//
// セキュリティ:
//   - Collector の Supabase 認証セッションで書き込み (anon key)
//   - RLS で「自分の email == google_email」の行だけ upsert 可能
//   - SELECT は禁止、サーバーサイド (service_role) からのみ読める
//   - organization_id を組織メンバーシップから自動解決 (migration 0059)

import { getSupabase } from './client'

const SCOPES_TRACKED = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
]

// AND° 組織 (organization_members に未登録の場合のフォールバック)
const AND_ORG_ID = '00000000-0000-0000-0000-000000000001'

/**
 * email から所属組織 ID を解決する。
 * organization_members に該当行があればその org、無ければ AND° 組織。
 *
 * 注: organization_members への SELECT は RLS 次第。
 * 失敗したら AND° にフォールバック (既存挙動の互換)。
 */
async function resolveOrganizationId(email: string): Promise<string> {
  try {
    const sb = getSupabase()
    const { data } = await sb
      .from('organization_members')
      .select('organization_id')
      .ilike('email', email)
      .maybeSingle()
    return (data?.organization_id as string) ?? AND_ORG_ID
  } catch {
    return AND_ORG_ID
  }
}

export async function syncRefreshTokenToSupabase(params: {
  email: string
  refreshToken: string
  accessibleChannelIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabase()
    const organizationId = await resolveOrganizationId(params.email)
    // 認証セッションが必要 (signInWithGoogleIdToken 済みでないと RLS に弾かれる)
    const { error } = await sb.from('youtube_oauth_tokens').upsert(
      {
        google_email: params.email,
        refresh_token: params.refreshToken,
        scopes: SCOPES_TRACKED,
        accessible_channel_ids: params.accessibleChannelIds,
        organization_id: organizationId
      },
      { onConflict: 'google_email' }
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * accessible_channel_ids だけを更新する (refresh_token は触らない)。
 * Realtime subscribe で新規 ch を検知したときに使う。
 */
export async function updateAccessibleChannelIdsForEmail(
  email: string,
  channelIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabase()
    const { error } = await sb
      .from('youtube_oauth_tokens')
      .update({ accessible_channel_ids: channelIds })
      .eq('google_email', email)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
