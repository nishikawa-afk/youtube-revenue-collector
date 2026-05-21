import Store from 'electron-store'
import type { GoogleAccount } from '@shared/types'

type AccountsMeta = {
  accounts: Record<string, { displayName: string | null; addedAt: string }>
}

const store = new Store<AccountsMeta>({
  name: 'accounts',
  defaults: { accounts: {} }
})

export function upsertAccountMeta(email: string, displayName: string | null): void {
  const all = store.get('accounts')
  const existing = all[email]
  all[email] = {
    displayName: displayName ?? existing?.displayName ?? null,
    addedAt: existing?.addedAt ?? new Date().toISOString()
  }
  store.set('accounts', all)
}

export function removeAccountMeta(email: string): void {
  const all = store.get('accounts')
  delete all[email]
  store.set('accounts', all)
}

export function listAccountMeta(emails: string[]): GoogleAccount[] {
  const all = store.get('accounts')
  return emails.map((email) => ({
    email,
    displayName: all[email]?.displayName ?? null,
    addedAt: all[email]?.addedAt ?? new Date().toISOString()
  }))
}
