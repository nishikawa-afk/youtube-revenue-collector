export type YoutubeChannel = {
  id: string
  youtube_channel_id: string
  channel_title: string
  case_id: string | null
  owner_email: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type YoutubeDailyMetrics = {
  channel_id: string
  date: string
  estimated_revenue: number | null
  ad_revenue: number | null
  red_partner_revenue: number | null
  gross_revenue: number | null
  views: number | null
  estimated_minutes_watched: number | null
  average_view_duration_seconds: number | null
  cpm: number | null
  playback_based_cpm: number | null
  monetized_playbacks: number | null
  ad_impressions: number | null
  subscribers_gained: number | null
  subscribers_lost: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  card_click_rate: number | null
  card_impressions: number | null
  card_clicks: number | null
  currency: string
  source: 'api' | 'studio'
  raw: unknown
}

export type GoogleAccount = {
  email: string
  displayName: string | null
  addedAt: string
}

export type FetchRunStatus = 'running' | 'success' | 'partial' | 'failed'

export type FetchRunSummary = {
  id: string
  startedAt: string
  finishedAt: string | null
  targetDateFrom: string
  targetDateTo: string
  channelCount: number
  successCount: number
  failedCount: number
  status: FetchRunStatus
  errorSummary: string | null
}

// Preload で renderer に晒すAPI
export type RendererAPI = {
  // Supabase auth (renderer 主導)
  supabaseSession: {
    getCurrent: () => Promise<{ email: string | null; signedIn: boolean }>
    signOut: () => Promise<void>
  }
  // Google accounts
  googleAccounts: {
    list: () => Promise<GoogleAccount[]>
    add: () => Promise<GoogleAccount>
    remove: (email: string) => Promise<void>
  }
  // Channels
  channels: {
    listFromYoutube: (accountEmail: string) => Promise<
      Array<{ id: string; title: string; thumbnailUrl: string | null }>
    >
    listRegistered: () => Promise<YoutubeChannel[]>
    register: (params: {
      youtubeChannelId: string
      channelTitle: string
      ownerEmail: string
      caseId?: string | null
    }) => Promise<YoutubeChannel>
    setActive: (id: string, isActive: boolean) => Promise<void>
    // Studio Manager 経由のチャンネルを URL/ID から手動追加
    addManual: (params: {
      accountEmail: string
      input: string
      caseId?: string | null
    }) => Promise<
      | { ok: true; channel: YoutubeChannel }
      | { ok: false; error: string }
    >
  }
  // Fetch
  fetch: {
    runNow: (params: { from?: string; to?: string }) => Promise<FetchRunSummary>
    listRuns: (limit?: number) => Promise<FetchRunSummary[]>
  }
  // Settings
  settings: {
    get: () => Promise<{
      cronTime: string // e.g. "0 7 * * *"
      timezone: string
    }>
    set: (s: { cronTime?: string; timezone?: string }) => Promise<void>
  }
}
