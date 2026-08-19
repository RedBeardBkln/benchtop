import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// API routes normally return `{ error }` JSON on failure, but a dropped mobile
// connection, a platform timeout, or a crash upstream of the handler can leave
// the body empty or non-JSON. Fall back to the status instead of throwing
// while parsing the error itself.
export async function readErrorMessage(response: Response, fallback = 'Request failed'): Promise<string> {
  const text = await response.text().catch(() => '')
  if (text) {
    try {
      const data = JSON.parse(text)
      if (data?.error) return data.error
    } catch {
      // Body wasn't JSON — fall through to the status-based message.
    }
  }
  return `${fallback} (${response.status})`
}
