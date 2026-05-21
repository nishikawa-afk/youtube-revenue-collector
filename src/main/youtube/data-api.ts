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

/**
 * チャンネル ID (UCxxx) を直接指定して詳細取得。
 * Studio Manager 経由 (mine=true では出ない) のチャンネルを手動追加する用。
 */
export async function fetchChannelById(
  accountEmail: string,
  youtubeChannelId: string
): Promise<ChannelSummary | null> {
  const accessToken = await getAccessToken(accountEmail)

  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('id', youtubeChannelId)

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`channels.list (by id) failed: ${resp.status} ${t}`)
  }
  const data = (await resp.json()) as {
    items?: Array<{
      id: string
      snippet: { title: string; thumbnails?: { default?: { url?: string } } }
    }>
  }
  const item = data.items?.[0]
  if (!item) return null
  return {
    id: item.id,
    title: item.snippet.title,
    thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null
  }
}

/**
 * YouTube のさまざまな URL 形式からチャンネル ID (UCxxx) を解決する。
 * - https://www.youtube.com/channel/UCxxx          → UCxxx (即返却)
 * - https://www.youtube.com/@handle                → API で解決
 * - https://www.youtube.com/c/customname           → API で解決 (legacy)
 * - https://www.youtube.com/user/username          → API で解決 (legacy)
 * - UCxxx (生 ID)                                  → そのまま
 */
export async function resolveChannelIdFromInput(
  accountEmail: string,
  input: string
): Promise<string | null> {
  const trimmed = input.trim()

  // 1. UC で始まる 22-26 字の channel ID 形式
  if (/^UC[A-Za-z0-9_-]{20,30}$/.test(trimmed)) return trimmed

  // 2. URL から /channel/UCxxx を抽出
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/)
  if (channelMatch) return channelMatch[1]

  // 3. @handle 形式
  const handleMatch = trimmed.match(/youtube\.com\/@([A-Za-z0-9_.-]+)/)
  if (handleMatch) {
    const accessToken = await getAccessToken(accountEmail)
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'id')
    url.searchParams.set('forHandle', '@' + handleMatch[1])
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (resp.ok) {
      const data = (await resp.json()) as { items?: Array<{ id: string }> }
      return data.items?.[0]?.id ?? null
    }
  }

  // 4. /c/ または /user/ → forUsername (legacy)
  const userMatch = trimmed.match(/youtube\.com\/(?:c|user)\/([A-Za-z0-9_-]+)/)
  if (userMatch) {
    const accessToken = await getAccessToken(accountEmail)
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'id')
    url.searchParams.set('forUsername', userMatch[1])
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (resp.ok) {
      const data = (await resp.json()) as { items?: Array<{ id: string }> }
      return data.items?.[0]?.id ?? null
    }
  }

  return null
}
