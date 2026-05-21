import { useEffect, useState } from 'react'
import type { FetchRunSummary } from '@shared/types'

export function StatusPage(): JSX.Element {
  const [latest, setLatest] = useState<FetchRunSummary | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh(): Promise<void> {
    const runs = await window.api.fetch.listRuns(1)
    setLatest(runs[0] ?? null)
  }

  async function runNow(): Promise<void> {
    setRunning(true)
    setMsg(null)
    try {
      const summary = await window.api.fetch.runNow({})
      setMsg(`取得完了: 成功 ${summary.successCount} / 失敗 ${summary.failedCount}`)
      await refresh()
    } catch (e) {
      setMsg(`エラー: ${(e as Error).message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>ステータス</h2>

      <div className="card">
        <h2>今日の取得</h2>
        {latest ? (
          <div>
            <div>
              対象期間: {latest.targetDateFrom} ～ {latest.targetDateTo}
            </div>
            <div>
              成功 {latest.successCount} / 失敗 {latest.failedCount}{' '}
              <span className={`status-pill ${latest.status === 'success' ? 'ok' : latest.status === 'partial' ? 'warn' : 'err'}`}>
                {latest.status}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
              開始: {new Date(latest.startedAt).toLocaleString('ja-JP')}
            </div>
          </div>
        ) : (
          <div style={{ color: '#94a3b8' }}>まだ取得実績がありません</div>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn" disabled={running} onClick={runNow}>
            {running ? '取得中…' : '🔄 今すぐ取得'}
          </button>
        </div>
        {msg && <div style={{ marginTop: 12, color: '#cbd5e1' }}>{msg}</div>}
      </div>

      <div className="card">
        <h2>次回スケジュール</h2>
        <div style={{ color: '#94a3b8' }}>毎朝 10:00 (Asia/Tokyo) — 設定タブで変更</div>
      </div>
    </div>
  )
}
