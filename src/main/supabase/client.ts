import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WS from 'ws'

// Node.js < 22 (Electron 32) はネイティブWebSocketが無いため polyfill + realtime transport で渡す
const g = globalThis as { WebSocket?: unknown }
if (typeof g.WebSocket === 'undefined') {
  g.WebSocket = WS
}

let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached
  const url = import.meta.env.MAIN_VITE_SUPABASE_URL
  const key = import.meta.env.MAIN_VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('MAIN_VITE_SUPABASE_URL / MAIN_VITE_SUPABASE_ANON_KEY が未設定です（.env を確認）')
  }
  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    },
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: WS as any
    }
  })
  return cached
}
