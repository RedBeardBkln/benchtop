// Public origin used for Stripe return URLs and invite links. Works behind Vercel: falls back to
// the request origin when NEXT_PUBLIC_APP_URL is not set.
export function getAppOrigin(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return requestOrigin
}
