import { useEffect, useState } from 'react'

export function SettingsPage(): JSX.Element {
  const [cronTime, setCronTime] = useState('0 7 * * *')
  const [timezone, setTimezone] = useState('Asia/Tokyo')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      const s = await window.api.settings.get()
      setCronTime(s.cronTime)
      setTimezone(s.timezone)
    })()
  }, [])

  async function save(): Promise<void> {
    await window.api.settings.set({ cronTime, timezone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>設定</h2>
      <div className="card">
        <h2>スケジュール</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>
            cron式（分 時 日 月 曜日）
          </label>
          <input
            type="text"
            value={cronTime}
            onChange={(e) => setCronTime(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'monospace',
              width: 240
            }}
          />
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            例: <code>0 10 * * *</code> = 毎朝10:00
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#94a3b8' }}>タイムゾーン</label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'monospace',
              width: 240
            }}
          />
        </div>
        <button className="btn" onClick={save}>
          保存
        </button>
        {saved && (
          <span style={{ marginLeft: 12, color: '#6ee7b7' }}>✓ 保存しました</span>
        )}
      </div>
    </div>
  )
}
