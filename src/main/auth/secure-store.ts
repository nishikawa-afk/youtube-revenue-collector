import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

/**
 * safeStorage（OSキーチェーンのキーで暗号化）でトークン等を保存する。
 * macOS: Keychain / Windows: DPAPI / Linux: kwallet など
 *
 * 各レコードは別ファイルに分けて保存:
 *   <userData>/secrets/<key>.bin  (暗号文)
 */

function dir(): string {
  return join(app.getPath('userData'), 'secrets')
}

function fileFor(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._@-]/g, '_')
  return join(dir(), `${safe}.bin`)
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage is not available on this system')
  }
  await fs.mkdir(dir(), { recursive: true, mode: 0o700 })
  const encrypted = safeStorage.encryptString(value)
  await fs.writeFile(fileFor(key), encrypted, { mode: 0o600 })
}

export async function getSecret(key: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(fileFor(key))
    return safeStorage.decryptString(buf)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    await fs.unlink(fileFor(key))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}

export async function listSecretKeys(prefix?: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir())
    const keys = files.filter((f) => f.endsWith('.bin')).map((f) => f.slice(0, -4))
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}
