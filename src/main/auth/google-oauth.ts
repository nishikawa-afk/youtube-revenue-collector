import { shell } from 'electron'
import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { URL, URLSearchParams } from 'node:url'
import { getSecret, setSecret, deleteSecret, listSecretKeys } from './secure-store'

/**
 * Google OAuth 2.0 PKCEフロー（デスクトップアプリ用）
 *
 * 流れ:
 *   1) ローカルHTTPサーバーを 127.0.0.1 のランダムポートで起動
 *   2) Googleの認可画面を外部ブラウザで開く（redirect_uri = http://127.0.0.1:<port>/callback）
 *   3) ユーザーが同意 → Googleが redirect_uri に code を付けてリダイレクト
 *   4) サーバーが code を受け取り、code + PKCE verifier をトークンエンドポイントに送る
 *   5) access_token / refresh_token / id_token を取得
 *   6) id_token から email を取り出し、refresh_token を safeStorage に保存
 */

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
]

const REFRESH_TOKEN_PREFIX = 'google_refresh.'

function clientCreds(): { id: string; secret: string } {
  const id = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID
  const secret = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET
  if (!id || !secret) {
    throw new Error(
      'MAIN_VITE_GOOGLE_CLIENT_ID / MAIN_VITE_GOOGLE_CLIENT_SECRET が未設定です（.env を確認）'
    )
  }
  return { id, secret }
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function genVerifier(): string {
  return base64Url(randomBytes(32))
}

function challengeFor(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  id_token: string
  expires_in: number
  token_type: string
  scope: string
}

function decodeIdToken(idToken: string): { email?: string; name?: string; sub?: string } {
  const payload = idToken.split('.')[1]
  if (!payload) return {}
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function startCallbackServer(): Promise<{
  port: number
  done: Promise<{ code: string; state: string }>
  close: () => void
}> {
  return new Promise((resolveOuter, rejectOuter) => {
    let resolveInner!: (v: { code: string; state: string }) => void
    let rejectInner!: (e: Error) => void
    const done = new Promise<{ code: string; state: string }>((res, rej) => {
      resolveInner = res
      rejectInner = rej
    })

    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400)
        res.end()
        return
      }
      const u = new URL(req.url, 'http://127.0.0.1')
      if (u.pathname !== '/callback') {
        res.writeHead(404)
        res.end()
        return
      }
      const code = u.searchParams.get('code')
      const state = u.searchParams.get('state')
      const error = u.searchParams.get('error')
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<h1>認証エラー</h1><p>${error}</p>`)
        rejectInner(new Error(`OAuth error: ${error}`))
        return
      }
      if (!code || !state) {
        res.writeHead(400)
        res.end('missing code or state')
        rejectInner(new Error('missing code or state'))
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <!doctype html><html><head><meta charset="utf-8"><title>認証完了</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; text-align: center;">
          <h1>✓ 認証完了しました</h1>
          <p>このタブを閉じて、アプリに戻ってください。</p>
        </body></html>
      `)
      resolveInner({ code, state })
    })

    server.on('error', rejectOuter)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        rejectOuter(new Error('server.address() unexpected'))
        return
      }
      resolveOuter({
        port: addr.port,
        done,
        close: () => server.close()
      })
    })
  })
}

async function exchangeCodeForTokens(params: {
  code: string
  verifier: string
  redirectUri: string
}): Promise<TokenResponse> {
  const { id, secret } = clientCreds()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: id,
    client_secret: secret,
    code_verifier: params.verifier,
    redirect_uri: params.redirectUri
  })

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`token exchange failed: ${resp.status} ${t}`)
  }
  return (await resp.json()) as TokenResponse
}

/** refresh_token を使って access_token を取得 */
export async function getAccessToken(email: string): Promise<string> {
  const { id, secret } = clientCreds()
  const refreshToken = await getSecret(REFRESH_TOKEN_PREFIX + email)
  if (!refreshToken) {
    throw new Error(`refresh_token がありません: ${email}（再認証が必要）`)
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret
  })
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`refresh failed: ${resp.status} ${t}`)
  }
  const data = (await resp.json()) as { access_token: string }
  return data.access_token
}

/** 新規アカウント追加（外部ブラウザで同意画面を開く） */
export async function startAddAccountFlow(): Promise<{
  email: string
  displayName: string | null
  idToken: string
}> {
  const { id } = clientCreds()
  const verifier = genVerifier()
  const challenge = challengeFor(verifier)
  const state = base64Url(randomBytes(16))

  const server = await startCallbackServer()
  const redirectUri = `http://127.0.0.1:${server.port}/callback`

  try {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', id)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES.join(' '))
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent') // refresh_token を毎回返してもらう

    await shell.openExternal(authUrl.toString())

    const callback = await server.done
    if (callback.state !== state) throw new Error('state mismatch')

    const tokens = await exchangeCodeForTokens({
      code: callback.code,
      verifier,
      redirectUri
    })

    const claims = decodeIdToken(tokens.id_token)
    const email = claims.email
    if (!email) throw new Error('id_token に email がありません')

    if (tokens.refresh_token) {
      await setSecret(REFRESH_TOKEN_PREFIX + email, tokens.refresh_token)
    } else {
      console.warn('[oauth] refresh_token not returned for', email)
    }

    return { email, displayName: claims.name ?? null, idToken: tokens.id_token }
  } finally {
    server.close()
  }
}

export async function listAccounts(): Promise<string[]> {
  const keys = await listSecretKeys(REFRESH_TOKEN_PREFIX)
  return keys.map((k) => k.slice(REFRESH_TOKEN_PREFIX.length))
}

export async function removeAccount(email: string): Promise<void> {
  await deleteSecret(REFRESH_TOKEN_PREFIX + email)
}
