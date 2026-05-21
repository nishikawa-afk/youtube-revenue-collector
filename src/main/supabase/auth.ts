import { getSupabase } from './client'
import { getSecret, setSecret, deleteSecret } from '../auth/secure-store'

const SESSION_KEY = 'supabase_session'

type StoredSession = {
  access_token: string
  refresh_token: string
}

export async function loadStoredSession(): Promise<void> {
  const raw = await getSecret(SESSION_KEY)
  if (!raw) return
  try {
    const s = JSON.parse(raw) as StoredSession
    const supabase = getSupabase()
    await supabase.auth.setSession(s)
  } catch (e) {
    console.warn('[supabase] failed to restore session:', e)
    await deleteSecret(SESSION_KEY)
  }
}

async function persistCurrentSession(): Promise<void> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    await deleteSecret(SESSION_KEY)
    return
  }
  await setSecret(
    SESSION_KEY,
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })
  )
}

/**
 * Google OAuth で取得した id_token を使って Supabase にサインインする。
 * Supabase Auth > Google provider > "Additional Client IDs" に
 * Desktop OAuth Client ID を登録しておくこと。
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<{ email: string | null }> {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken
  })
  if (error) throw error
  await persistCurrentSession()
  return { email: data.user?.email ?? null }
}

export async function getCurrentSupabaseUser(): Promise<{
  email: string | null
  signedIn: boolean
}> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser()
  return { email: data.user?.email ?? null, signedIn: !!data.user }
}

export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase()
  await supabase.auth.signOut()
  await deleteSecret(SESSION_KEY)
}
