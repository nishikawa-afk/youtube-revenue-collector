import { useState } from 'react'
import { StatusPage } from './pages/Status'
import { AccountsPage } from './pages/Accounts'
import { ChannelsPage } from './pages/Channels'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'

type Tab = 'status' | 'accounts' | 'channels' | 'history' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'status', label: '📊 ステータス' },
  { key: 'accounts', label: '👤 Googleアカウント' },
  { key: 'channels', label: '🎥 監視チャンネル' },
  { key: 'history', label: '🕘 取得履歴' },
  { key: 'settings', label: '⚙️ 設定' }
]

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('status')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>YouTube Revenue Collector</h1>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`nav-item ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </aside>
      <main className="main">
        {tab === 'status' && <StatusPage />}
        {tab === 'accounts' && <AccountsPage />}
        {tab === 'channels' && <ChannelsPage />}
        {tab === 'history' && <HistoryPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
