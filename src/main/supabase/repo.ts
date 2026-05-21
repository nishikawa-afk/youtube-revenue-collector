import { hostname } from 'node:os'
import { getSupabase } from './client'
import type { AnalyticsRow } from '../youtube/analytics-api'
import type { FetchRunSummary, FetchRunStatus, YoutubeChannel } from '@shared/types'

export async function listChannels(): Promise<YoutubeChannel[]> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('youtube_channels')
    .select('*')
    .order('channel_title', { ascending: true })
  if (error) throw error
  return (data ?? []) as YoutubeChannel[]
}

export async function listActiveChannels(): Promise<YoutubeChannel[]> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('youtube_channels')
    .select('*')
    .eq('is_active', true)
    .order('channel_title', { ascending: true })
  if (error) throw error
  return (data ?? []) as YoutubeChannel[]
}

export async function registerChannel(params: {
  youtubeChannelId: string
  channelTitle: string
  ownerEmail: string
  caseId?: string | null
}): Promise<YoutubeChannel> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('youtube_channels')
    .upsert(
      {
        youtube_channel_id: params.youtubeChannelId,
        channel_title: params.channelTitle,
        owner_email: params.ownerEmail,
        case_id: params.caseId ?? null,
        is_active: true
      },
      { onConflict: 'youtube_channel_id' }
    )
    .select('*')
    .single()
  if (error) throw error
  return data as YoutubeChannel
}

export async function setChannelActive(id: string, isActive: boolean): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('youtube_channels').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function upsertDailyMetrics(params: {
  channelId: string
  rows: AnalyticsRow[]
  userId: string | null
}): Promise<number> {
  if (params.rows.length === 0) return 0
  const sb = getSupabase()
  const records = params.rows.map((r) => ({
    channel_id: params.channelId,
    date: r.date,
    estimated_revenue: r.estimatedRevenue,
    ad_revenue: r.adRevenue,
    red_partner_revenue: r.redPartnerRevenue,
    gross_revenue: r.grossRevenue,
    views: r.views,
    estimated_minutes_watched: r.estimatedMinutesWatched,
    average_view_duration_seconds: r.averageViewDuration,
    cpm: r.cpm,
    playback_based_cpm: r.playbackBasedCpm,
    monetized_playbacks: r.monetizedPlaybacks,
    ad_impressions: r.adImpressions,
    subscribers_gained: r.subscribersGained,
    subscribers_lost: r.subscribersLost,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    card_click_rate: r.cardClickRate,
    card_impressions: r.cardImpressions,
    card_clicks: r.cardClicks,
    currency: r.currency,
    source: 'api',
    raw: r.raw,
    fetched_at: new Date().toISOString(),
    fetched_by: params.userId,
    machine_id: hostname()
  }))
  const { error, count } = await sb
    .from('youtube_daily_metrics')
    .upsert(records, { onConflict: 'channel_id,date', count: 'exact' })
  if (error) throw error
  return count ?? records.length
}

export async function createRun(params: {
  targetDateFrom: string
  targetDateTo: string
  channelCount: number
  userId: string | null
}): Promise<string> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('youtube_fetch_runs')
    .insert({
      target_date_from: params.targetDateFrom,
      target_date_to: params.targetDateTo,
      channel_count: params.channelCount,
      fetched_by: params.userId,
      machine_id: hostname(),
      status: 'running'
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function finishRun(params: {
  id: string
  successCount: number
  failedCount: number
  status: FetchRunStatus
  errorSummary?: string | null
  details?: unknown
}): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb
    .from('youtube_fetch_runs')
    .update({
      finished_at: new Date().toISOString(),
      success_count: params.successCount,
      failed_count: params.failedCount,
      status: params.status,
      error_summary: params.errorSummary ?? null,
      details: params.details ?? null
    })
    .eq('id', params.id)
  if (error) throw error
}

export async function listRuns(limit = 20): Promise<FetchRunSummary[]> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('youtube_fetch_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    targetDateFrom: r.target_date_from,
    targetDateTo: r.target_date_to,
    channelCount: r.channel_count,
    successCount: r.success_count,
    failedCount: r.failed_count,
    status: r.status,
    errorSummary: r.error_summary
  }))
}
