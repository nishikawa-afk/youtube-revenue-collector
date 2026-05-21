import { useEffect, useState } from 'react'
import type { FetchRunSummary } from '@shared/types'

export function HistoryPage(): JSX.Element {
  const [runs, setRuns] = useState<FetchRunSummary[]>([])

  useEffect(() => {
    void (async () => {
      setRuns(await window.api.fetch.listRuns(50))
    })()
  }, [])

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>取得履歴</h2>
      <div className="card">
        {runs.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>履歴がありません</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>開始</th>
                <th>対象</th>
                <th>成功</th>
                <th>失敗</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: '#cbd5e1' }}>
                    {new Date(r.startedAt).toLocaleString('ja-JP')}
                  </td>
                  <td style={{ color: '#94a3b8' }}>
                    {r.targetDateFrom} ～ {r.targetDateTo}
                  </td>
                  <td>{r.successCount}</td>
                  <td>{r.failedCount}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        r.status === 'success' ? 'ok' : r.status === 'partial' ? 'warn' : 'err'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
