import { useEffect, useState } from 'react'
import type { GoogleAccount, YoutubeChannel } from '@shared/types'

type Discovered = { id: string; title: string; thumbnailUrl: string | null }

export function ChannelsPage(): JSX.Element {
  const [registered, setRegistered] = useState<YoutubeChannel[]>([])
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [discovered, setDiscovered] = useState<Discovered[]>([])
  const [loading, setLoading] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)

  // Studio Manager 経由 手動追加
  const [manualInput, setManualInput] = useState('')
  const [manualAccount, setManualAccount] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void (async () => {
      const [r, a] = await Promise.all([
        window.api.channels.listRegistered().catch((e) => {
          setLoadError(`チャンネル一覧の取得失敗: ${(e as Error).message}`)
          return [] as YoutubeChannel[]
        }),
        window.api.googleAccounts.list().catch((e) => {
          setLoadError(`アカウント一覧の取得失敗: ${(e as Error).message}`)
          return [] as GoogleAccount[]
        })
      ])
      setRegistered(r)
      setAccounts(a)
    })()
  }, [])

  async function discover(email: string): Promise<void> {
    setSelectedAccount(email)
    setLoading(true)
    try {
      setDiscovered(await window.api.channels.listFromYoutube(email))
    } finally {
      setLoading(false)
    }
  }

  async function register(d: Discovered): Promise<void> {
    await window.api.channels.register({
      youtubeChannelId: d.id,
      channelTitle: d.title,
      ownerEmail: selectedAccount
    })
    setRegistered(await window.api.channels.listRegistered())
  }

  async function toggle(c: YoutubeChannel): Promise<void> {
    await window.api.channels.setActive(c.id, !c.is_active)
    setRegistered(await window.api.channels.listRegistered())
  }

  async function addManual(): Promise<void> {
    if (!manualInput.trim() || !manualAccount) {
      setManualMsg({ kind: 'err', text: 'チャンネル URL/ID と アカウントを入力してください' })
      return
    }
    setManualBusy(true)
    setManualMsg(null)
    try {
      const res = await window.api.channels.addManual({
        accountEmail: manualAccount,
        input: manualInput.trim()
      })
      if (res.ok) {
        setManualMsg({ kind: 'ok', text: `✅ 登録完了: ${res.channel.channel_title}` })
        setManualInput('')
        setRegistered(await window.api.channels.listRegistered())
      } else {
        setManualMsg({ kind: 'err', text: res.error })
      }
    } catch (e) {
      setManualMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setManualBusy(false)
    }
  }

  const registeredIds = new Set(registered.map((c) => c.youtube_channel_id))

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>監視チャンネル</h2>

      {loadError && (
        <div className="card" style={{ borderColor: '#7f1d1d', color: '#fca5a5' }}>
          {loadError}
        </div>
      )}

      <div className="card">
        <h2>登録済みチャンネル ({registered.length})</h2>
        {registered.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>まだ登録されていません</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>チャンネル</th>
                <th>所有アカウント</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {registered.map((c) => (
                <tr key={c.id}>
                  <td>{c.channel_title}</td>
                  <td style={{ color: '#94a3b8' }}>{c.owner_email ?? '-'}</td>
                  <td>
                    <span className={`status-pill ${c.is_active ? 'ok' : 'warn'}`}>
                      {c.is_active ? '有効' : '停止'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => toggle(c)}>
                      {c.is_active ? '停止' : '再開'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>手動追加 (Studio Manager 用)</h2>
        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
          YouTube Studio で Manager 権限を付与されたチャンネル (mine=true で出てこない) を手動で追加します。
          URL or チャンネル ID (UCxxx) を貼ってください。
        </div>
        {accounts.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>先に「Googleアカウント」タブでアカウントを追加してください</div>
        ) : (
          <>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={manualAccount}
                onChange={(e) => setManualAccount(e.target.value)}
                style={{ padding: '8px 12px', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 6 }}
              >
                <option value="">アカウント選択...</option>
                {accounts.map((a) => (
                  <option key={a.email} value={a.email}>{a.email}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="https://www.youtube.com/channel/UCxxx または UCxxx または @handle"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                style={{ flex: 1, minWidth: 280, padding: '8px 12px', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 6 }}
              />
              <button className="btn" onClick={addManual} disabled={manualBusy}>
                {manualBusy ? '検証中...' : '+ 追加'}
              </button>
            </div>
            {manualMsg && (
              <div style={{
                padding: 8,
                borderRadius: 6,
                background: manualMsg.kind === 'ok' ? '#064e3b' : '#7f1d1d',
                color: manualMsg.kind === 'ok' ? '#a7f3d0' : '#fca5a5',
                fontSize: 13
              }}>
                {manualMsg.text}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>YouTubeから追加 (オーナー権限)</h2>
        {accounts.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>先に「Googleアカウント」タブでアカウントを追加してください</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              {accounts.map((a) => (
                <button
                  key={a.email}
                  className={`btn ${selectedAccount === a.email ? '' : 'btn-secondary'}`}
                  style={{ marginRight: 8 }}
                  onClick={() => discover(a.email)}
                >
                  {a.email}
                </button>
              ))}
            </div>
            {loading && <div style={{ color: '#94a3b8' }}>読み込み中…</div>}
            {!loading && discovered.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>チャンネル</th>
                    <th>ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {discovered.map((d) => {
                    const already = registeredIds.has(d.id)
                    return (
                      <tr key={d.id}>
                        <td>
                          {d.thumbnailUrl && (
                            <img src={d.thumbnailUrl} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />
                          )}
                        </td>
                        <td>{d.title}</td>
                        <td style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>{d.id}</td>
                        <td>
                          <button className="btn" disabled={already} onClick={() => register(d)}>
                            {already ? '登録済み' : '＋ 登録'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
