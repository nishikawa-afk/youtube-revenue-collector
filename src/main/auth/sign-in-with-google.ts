import { startAddAccountFlow } from './google-oauth'
import { signInWithGoogleIdToken, getCurrentSupabaseUser } from '../supabase/auth'

/**
 * Google OAuthでアカウントを追加し、まだSupabaseセッションが無ければ
 * 取得した id_token を使って Supabase にもサインインする。
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
  return { email: result.email, displayName: result.displayName }
}
