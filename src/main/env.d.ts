interface ImportMetaEnv {
  readonly MAIN_VITE_SUPABASE_URL: string
  readonly MAIN_VITE_SUPABASE_ANON_KEY: string
  readonly MAIN_VITE_GOOGLE_CLIENT_ID: string
  readonly MAIN_VITE_GOOGLE_CLIENT_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
