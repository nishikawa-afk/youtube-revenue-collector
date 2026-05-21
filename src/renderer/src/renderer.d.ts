import type { RendererAPI } from '@shared/types'

declare global {
  interface Window {
    api: RendererAPI
  }
}

export {}
