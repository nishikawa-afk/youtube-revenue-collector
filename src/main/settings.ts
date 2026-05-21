import Store from 'electron-store'

type Settings = {
  cronTime: string
  timezone: string
}

const store = new Store<Settings>({
  name: 'settings',
  defaults: {
    cronTime: '0 10 * * *', // 毎朝10:00（PCが稼働してる確率が高い時間）
    timezone: 'Asia/Tokyo'
  }
})

export function getSettings(): Settings {
  return {
    cronTime: store.get('cronTime'),
    timezone: store.get('timezone')
  }
}

export function setSettings(patch: Partial<Settings>): void {
  if (patch.cronTime !== undefined) store.set('cronTime', patch.cronTime)
  if (patch.timezone !== undefined) store.set('timezone', patch.timezone)
}
