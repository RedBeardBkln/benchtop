import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Teams' AI keys are encrypted at rest with AES-256-GCM. The 256-bit key is the SHA-256 of
// AI_KEY_SECRET (a long random string set in the environment), so any length secret works.
// Format: v1.<iv>.<auth tag>.<ciphertext>, each base64url.

export class AiKeySecretMissingError extends Error {
  constructor() { super('AI_KEY_SECRET is not set'); this.name = 'AiKeySecretMissingError' }
}

function secretKey(secret = process.env.AI_KEY_SECRET): Buffer {
  if (!secret || secret.trim().length < 16) throw new AiKeySecretMissingError()
  return createHash('sha256').update(secret.trim()).digest()
}

export function isKeyEncryptionConfigured(): boolean {
  return (process.env.AI_KEY_SECRET?.trim().length ?? 0) >= 16
}

export function encryptApiKey(plain: string, secret?: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secretKey(secret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function decryptApiKey(stored: string, secret?: string): string {
  const [version, iv, tag, data] = stored.split('.')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognized key format')
  const decipher = createDecipheriv('aes-256-gcm', secretKey(secret), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

/** Last four characters: enough to tell keys apart without revealing them */
export const keyHint = (key: string) => key.trim().slice(-4)
