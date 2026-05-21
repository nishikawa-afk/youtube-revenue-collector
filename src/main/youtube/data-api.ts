import { getAccessToken } from '../auth/google-oauth'

type ChannelSummary = {
  id: string
  title: string
  thumbnailUrl: string | null
}

/**
 * 認証済みアカウントが管理しているチャンネル一覧を取得する。
 * mine=true でログインユーザーが所有するチャンネルを返す。
 */
export async function listMyChannels(accountEmail: string): Promise<ChannelSummary[]> {
  const accessToken = await getAccessToken(accountEmail)

  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('mine', 'true')
  url.searchParams.set('maxResults', '50')

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`channels.list failed: ${resp.status} ${t}`)
  }
  const data = (await resp.json()) as {
    items?: Array<{
      id: string
      snippet: { title: string; thumbnails?: { default?: { url?: string } } }
    }>
  }
  return (data.items ?? []).map((it) => ({
    id: it.id,
    title: it.snippet.title,
    thumbnailUrl: it.snippet.thumbnails?.default?.url ?? null
  }))
}
