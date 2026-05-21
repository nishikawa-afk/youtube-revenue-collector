import cron, { type ScheduledTask } from 'node-cron'
import { runDailyFetch } from './fetcher'
import { getSettings } from './settings'

let task: ScheduledTask | null = null

export function initScheduler(): void {
  const { cronTime, timezone } = getSettings()
  scheduleAt(cronTime, timezone)
}

export function scheduleAt(cronTime: string, timezone: string): void {
  if (task) {
    task.stop()
    task = null
  }
  if (!cron.validate(cronTime)) {
    console.warn('[scheduler] invalid cron expression:', cronTime)
    return
  }
  task = cron.schedule(
    cronTime,
    () => {
      runDailyFetch({ trigger: 'cron' }).catch((err) => {
        console.error('[scheduler] runDailyFetch failed:', err)
      })
    },
    { timezone }
  )
  console.log(`[scheduler] registered: "${cronTime}" (${timezone})`)
}
