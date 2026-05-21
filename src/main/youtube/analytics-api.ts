import { getAccessToken } from '../auth/google-oauth'

/**
 * YouTube Analytics API v2 — チャンネル日次メトリクス
 * https://developers.google.com/youtube/analytics/reference/reports/query
 */

const METRICS = [
  // 収益
  'estimatedRevenue',
  'estimatedAdRevenue',
  'estimatedRedPartnerRevenue',
  'grossRevenue',
  // パフォーマンス
  'views',
  'estimatedMinutesWatched',
  'averageViewDuration',
  // 広告
  'cpm',
  'playbackBasedCpm',
  'monetizedPlaybacks',
  'adImpressions',
  // エンゲージメント
  'subscribersGained',
  'subscribersLost',
  'likes',
  'comments',
  'shares',
  // カード
  'cardClickRate',
  'cardImpressions',
  'cardClicks'
].join(',')

export type AnalyticsRow = {
  date: string
  estimatedRevenue: number | null
  adRevenue: number | null
  redPartnerRevenue: number | null
  grossRevenue: number | null
  views: number | null
  estimatedMinutesWatched: number | null
  averageViewDuration: number | null
  cpm: number | null
  playbackBasedCpm: number | null
  monetizedPlaybacks: number | null
  adImpressions: number | null
  subscribersGained: number | null
  subscribersLost: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  cardClickRate: number | null
  cardImpressions: number | null
  cardClicks: number | null
  currency: string
  raw: unknown
}

/**
 * 指定チャンネルの日次メトリクスを取得（YYYY-MM-DD 範囲、両端含む）
 *
 * @param accountEmail このチャンネルにアナリティクス権限があるGoogleアカウント
 * @param youtubeChannelId UC... 形式のチャンネルID
 */
export async function getDailyMetrics(params: {
  accountEmail: string
  youtubeChannelId: string
  startDate: string
  endDate: string
}): Promise<AnalyticsRow[]> {
  const accessToken = await getAccessToken(params.accountEmail)

  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${params.youtubeChannelId}`)
  url.searchParams.set('startDate', params.startDate)
  url.searchParams.set('endDate', params.endDate)
  url.searchParams.set('metrics', METRICS)
  url.searchParams.set('dimensions', 'day')
  url.searchParams.set('sort', 'day')
  url.searchParams.set('currency', 'USD')

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`analytics.query failed: ${resp.status} ${t}`)
  }
  const data = (await resp.json()) as {
    columnHeaders?: Array<{ name: string; columnType: string; dataType: string }>
    rows?: Array<Array<number | string | null>>
  }

  if (!data.columnHeaders || !data.rows) return []

  const headerIndex = new Map<string, number>()
  data.columnHeaders.forEach((h, i) => headerIndex.set(h.name, i))

  const num = (row: Array<number | string | null>, key: string): number | null => {
    const i = headerIndex.get(key)
    if (i === undefined) return null
    const v = row[i]
    if (v === null || v === undefined) return null
    return typeof v === 'number' ? v : Number(v)
  }
  const str = (row: Array<number | string | null>, key: string): string => {
    const i = headerIndex.get(key)
    if (i === undefined) return ''
    return String(row[i] ?? '')
  }

  return data.rows.map((row) => ({
    date: str(row, 'day'),
    estimatedRevenue: num(row, 'estimatedRevenue'),
    adRevenue: num(row, 'estimatedAdRevenue'),
    redPartnerRevenue: num(row, 'estimatedRedPartnerRevenue'),
    grossRevenue: num(row, 'grossRevenue'),
    views: num(row, 'views'),
    estimatedMinutesWatched: num(row, 'estimatedMinutesWatched'),
    averageViewDuration: num(row, 'averageViewDuration'),
    cpm: num(row, 'cpm'),
    playbackBasedCpm: num(row, 'playbackBasedCpm'),
    monetizedPlaybacks: num(row, 'monetizedPlaybacks'),
    adImpressions: num(row, 'adImpressions'),
    subscribersGained: num(row, 'subscribersGained'),
    subscribersLost: num(row, 'subscribersLost'),
    likes: num(row, 'likes'),
    comments: num(row, 'comments'),
    shares: num(row, 'shares'),
    cardClickRate: num(row, 'cardClickRate'),
    cardImpressions: num(row, 'cardImpressions'),
    cardClicks: num(row, 'cardClicks'),
    currency: 'USD',
    raw: row
  }))
}

/**
 * 指定したチャンネルに対して analytics クエリ可能かを軽量検証する。
 * 直近1日 (yesterday) のメトリクスを1指標だけ取って 200 が返れば権限あり。
 * 403 → Manager 権限なし、404 → チャンネル不存在、その他 → エラー。
 */
export async function verifyChannelAccess(
  accountEmail: string,
  youtubeChannelId: string
): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const accessToken = await getAccessToken(accountEmail)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const ymd = yesterday.toISOString().slice(0, 10)

  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
  url.searchParams.set('ids', `channel==${youtubeChannelId}`)
  url.searchParams.set('startDate', ymd)
  url.searchParams.set('endDate', ymd)
  url.searchParams.set('metrics', 'views')

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (resp.ok) return { ok: true }
  let reason = `HTTP ${resp.status}`
  try {
    const body = await resp.text()
    reason = body.slice(0, 200)
  } catch {}
  return { ok: false, status: resp.status, reason }
}
