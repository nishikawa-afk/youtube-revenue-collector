import { startAddAccountFlow } from './google-oauth'
import { signInWithGoogleIdToken, getCurrentSupabaseUser } from '../supabase/auth'
import { syncRefreshTokenToSupabase } from '../supabase/oauthSync'
import { listMyChannels } from '../youtube/data-api'

/**
 * Google OAuthでアカウントを追加し、まだSupabaseセッションが無ければ
 * 取得した id_token を使って Supabase にもサインインする。
 * さらに refresh_token を Supabase の youtube_oauth_tokens に同期 (Coach がリアルタイム
 * Analytics API を叩くため)。
 *
 * 既にサインイン済みの場合（別のkeieiユーザーとして入っている）は、
 * Supabaseセッションは維持し、新しいGoogleアカウントはYouTubeトークン保存のみ。
 */
export async function startAddAccountFlowAndSignIn(): Promise<{
  email: string
  displayName: string | null
}> {
  const result = await startAddAccountFlow()
  const current = await getCurrentSupabaseUser()
  if (!current.signedIn) {
    try {
      await signInWithGoogleIdToken(result.idToken)
    } catch (e) {
      console.warn('[auth] Supabase signInWithIdToken failed:', (e as Error).message)
      // ここで失敗しても YouTube tokens は保存済み。
      // 後で「Supabaseにサインイン」ボタンから再試行可能にする。
    }
  }

  // refresh_token を Supabase に sync (Coach リアルタイム Analytics 用)
  // best-effort: 失敗してもメインフローは進める
  if (result.refreshToken) {
    try {
      const channels = await listMyChannels(result.email).catch(() => [])
      const accessibleIds = channels.map((c) => c.id)
      const syncResult = await syncRefreshTokenToSupabase({
        email: result.email,
        refreshToken: result.refreshToken,
        accessibleChannelIds: accessibleIds
      })
      if (!syncResult.ok) {
        console.warn('[oauthSync] failed:', syncResult.error)
      }
    } catch (e) {
      console.warn('[oauthSync] error:', (e as Error).message)
    }
  }

  return { email: result.email, displayName: result.displayName }
}
