import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * SSRF guard for server-side fetches of user-supplied URLs.
 *
 * - Only http/https, no credentials in the URL.
 * - The host must be a public address: loopback, private (RFC1918), link-local (incl. the cloud metadata
 *   address 169.254.169.254), CGNAT, multicast, reserved, unspecified and documentation ranges are rejected for
 *   IPv4 and IPv6 (including IPv4-mapped / NAT64 / 6to4 forms). Hostnames are resolved and ALL returned
 *   addresses must be public.
 * - Redirects are followed manually (small cap) and every hop is re-validated.
 *
 * Numeric host encodings (decimal 2130706433, hex 0x7f000001, octal 0177.0.0.1, short 127.1) are normalised to
 * dotted-quad by the WHATWG URL parser before we look at them, so they hit the IP checks directly.
 *
 * KNOWN LIMITATION (DNS rebinding / TOCTOU): we validate the addresses returned by our own DNS lookup, but the
 * subsequent fetch() performs its own resolution, and Node's global fetch gives us no hook to pin the connection
 * to the validated IP. A hostile DNS server could return a public address to us and a private one to fetch().
 * Closing that fully needs a pinned dispatcher (e.g. an undici Agent with a custom connect.lookup) or an egress
 * proxy / network-level block of private ranges. Do that at the infrastructure level for defence in depth.
 */

export class UnsafeUrlError extends Error {
  constructor(message = 'URL not allowed') {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export type LookupResult = { address: string; family: number }
export type LookupFn = (hostname: string) => Promise<LookupResult[]>

const defaultLookup: LookupFn = async (hostname) => dnsLookup(hostname, { all: true, verbatim: true })

// ── IP classification ────────────────────────────────────────────────────────

function parseIPv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  return parts.every((n) => n <= 255) ? parts : null
}

function isBlockedIPv4(o: number[]): boolean {
  const [a, b, c] = o
  if (a === 0) return true // 0.0.0.0/8 "this network" / unspecified
  if (a === 10) return true // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 0 && c === 0) return true // IETF protocol assignments 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true // deprecated 6to4 relay anycast
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true // TEST-NET-3
  if (a >= 224) return true // multicast 224/4, reserved 240/4, broadcast
  return false
}

function parseIPv6(s: string): number[] | null {
  if (s.includes('%')) return null // zone ids: fail closed
  let str = s
  let tail4: number[] = []
  if (str.includes('.')) {
    const idx = str.lastIndexOf(':')
    const v4 = parseIPv4(str.slice(idx + 1))
    if (!v4) return null
    tail4 = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]]
    str = str.slice(0, idx + 1) + '0:0' // placeholder groups, replaced below
  }
  const halves = str.split('::')
  if (halves.length > 2) return null
  const toGroups = (h: string) => (h === '' ? [] : h.split(':'))
  const head = toGroups(halves[0])
  const tail = halves.length === 2 ? toGroups(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (all.length !== 8) return null
  const groups: number[] = []
  for (const g of all) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
    groups.push(parseInt(g, 16))
  }
  if (tail4.length) {
    groups[6] = tail4[0]
    groups[7] = tail4[1]
  }
  return groups
}

const v4FromGroups = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]

function isBlockedIPv6(g: number[]): boolean {
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0)

  // ::/96 covers unspecified (::), loopback (::1) and deprecated IPv4-compatible addresses.
  if (zeros(0, 6)) return true
  // ::ffff:a.b.c.d IPv4-mapped: judge by the embedded IPv4 address.
  if (zeros(0, 5) && g[5] === 0xffff) return isBlockedIPv4(v4FromGroups(g[6], g[7]))
  // 64:ff9b::/96 NAT64: judge by the embedded IPv4 address.
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return isBlockedIPv4(v4FromGroups(g[6], g[7]))
  // 2002::/16 6to4: judge by the embedded IPv4 address.
  if (g[0] === 0x2002) return isBlockedIPv4(v4FromGroups(g[1], g[2]))

  // Everything outside global unicast 2000::/3 is blocked: fc00::/7 ULA, fe80::/10 link-local,
  // fec0::/10 site-local, ff00::/8 multicast, 100::/64 discard, ::ffff:0:0:0/96, etc.
  if ((g[0] & 0xe000) !== 0x2000) return true
  if (g[0] === 0x2001 && g[1] < 0x0200) return true // 2001::/23 IETF assignments (Teredo, ORCHID, ...)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation 2001:db8::/32
  if (g[0] === 0x3fff && g[1] < 0x1000) return true // documentation 3fff::/20
  return false
}

/** True if the textual IP address is not a public, globally routable address. Fails closed on garbage. */
export function isBlockedIp(ip: string): boolean {
  const host = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip
  const family = isIP(host)
  if (family === 4) {
    const o = parseIPv4(host)
    return o ? isBlockedIPv4(o) : true
  }
  if (family === 6) {
    const g = parseIPv6(host)
    return g ? isBlockedIPv6(g) : true
  }
  return true
}

// ── URL validation ───────────────────────────────────────────────────────────

const BLOCKED_NAME_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa']

/**
 * Validate a URL for server-side fetching and return the parsed URL. Throws UnsafeUrlError when the URL must not
 * be fetched; throws a plain Error when the host simply cannot be resolved.
 */
export async function assertPublicUrl(urlStr: string, lookup: LookupFn = defaultLookup): Promise<URL> {
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    throw new UnsafeUrlError('Invalid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http and https URLs are allowed')
  if (url.username || url.password) throw new UnsafeUrlError('URLs with credentials are not allowed')

  let host = url.hostname.toLowerCase()
  if (host.endsWith('.')) host = host.slice(0, -1)
  if (!host) throw new UnsafeUrlError('Invalid URL')

  // IP literal (URL has already normalised decimal/hex/octal forms to dotted-quad; IPv6 comes bracketed).
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  if (isIP(bare)) {
    if (isBlockedIp(bare)) throw new UnsafeUrlError()
    return url
  }

  if (host === 'localhost' || BLOCKED_NAME_SUFFIXES.some((s) => host.endsWith(s))) throw new UnsafeUrlError()
  // Single-label names ("metadata", "redis", "intranet") are internal service names, never public sites.
  if (!host.includes('.')) throw new UnsafeUrlError()

  let addrs: LookupResult[]
  try {
    addrs = await lookup(host)
  } catch {
    throw new Error('Could not resolve host')
  }
  if (!addrs.length) throw new Error('Could not resolve host')
  // ANY non-public answer rejects the URL (a mixed answer is a classic rebinding setup).
  if (addrs.some((a) => isBlockedIp(a.address))) throw new UnsafeUrlError()
  return url
}

// ── Fetch with manual, re-validated redirects ────────────────────────────────

export const MAX_REDIRECTS = 4
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export type SafeFetchOptions = {
  maxRedirects?: number
  /** Injected for tests; defaults to dns.promises.lookup(all). */
  lookup?: LookupFn
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/**
 * GET-style fetch that validates the URL and every redirect hop with assertPublicUrl. `init.redirect` is forced
 * to 'manual'. The same `init.signal` (timeout) applies across all hops.
 */
export async function safeFetch(urlStr: string, init: RequestInit = {}, opts: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = MAX_REDIRECTS, lookup = defaultLookup, fetchImpl = fetch } = opts
  let current = urlStr
  for (let hop = 0; ; hop++) {
    const url = await assertPublicUrl(current, lookup)
    const res = await fetchImpl(url.toString(), { ...init, redirect: 'manual' })
    if (!REDIRECT_STATUSES.has(res.status)) return res

    const location = res.headers.get('location')
    // Release the redirect response's body, we never read it.
    res.body?.cancel().catch(() => {})
    if (!location) throw new Error(`HTTP ${res.status} redirect without Location`)
    if (hop >= maxRedirects) throw new Error('Too many redirects')
    try {
      current = new URL(location, url).toString()
    } catch {
      throw new UnsafeUrlError('Invalid redirect URL')
    }
  }
}

/** Read a response body as text, stopping after `maxBytes` (the remainder is dropped, not an error). */
export async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let out = ''
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = received + value.byteLength > maxBytes ? value.subarray(0, maxBytes - received) : value
      received += chunk.byteLength
      out += decoder.decode(chunk, { stream: true })
    }
    out += decoder.decode()
  } finally {
    reader.cancel().catch(() => {})
  }
  return out
}
