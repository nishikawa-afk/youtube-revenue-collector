import { useEffect, useState } from 'react'
import type { GoogleAccount } from '@shared/types'

export function AccountsPage(): JSX.Element {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh(): Promise<void> {
    setAccounts(await window.api.googleAccounts.list())
  }

  async function add(): Promise<void> {
    setAdding(true)
    setErr(null)
    try {
      await window.api.googleAccounts.add()
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function remove(email: string): Promise<void> {
    if (!confirm(`${email} を削除しますか？保存済みのトークンも消えます。`)) return
    await window.api.googleAccounts.remove(email)
    await refresh()
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Googleアカウント</h2>

      <div className="card">
        <p style={{ marginTop: 0, color: '#94a3b8' }}>
          チャンネル所有者のGoogleアカウントごとに追加します。クライアント運用代行のチャンネルは、
          そのチャンネルにアナリティクス権限を持つアカウントを追加してください。
        </p>
        <button className="btn" disabled={adding} onClick={add}>
          {adding ? '認証中…' : '＋ Googleアカウントを追加'}
        </button>
        {err && <div style={{ marginTop: 12, color: '#fca5a5' }}>{err}</div>}
      </div>

      <div className="card">
        <h2>登録済みアカウント</h2>
        {accounts.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>まだ登録されていません</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>メール</th>
                <th>表示名</th>
                <th>追加日</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.email}>
                  <td>{a.email}</td>
                  <td>{a.displayName ?? '-'}</td>
                  <td style={{ color: '#94a3b8' }}>
                    {new Date(a.addedAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => remove(a.email)}>
                      削除
                    </button>
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
