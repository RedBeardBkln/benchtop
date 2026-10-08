import { describe, expect, it, vi } from 'vitest'
import {
  assertPublicUrl,
  isBlockedIp,
  readTextCapped,
  safeFetch,
  UnsafeUrlError,
  type LookupFn,
} from '@/lib/safe-fetch'

// No real network or DNS in these tests: lookup and fetch are always injected.
const PUBLIC_V4 = '93.184.216.34'
const publicLookup: LookupFn = async () => [{ address: PUBLIC_V4, family: 4 }]
const failingLookup: LookupFn = async () => {
  throw new Error('lookup must not be called')
}
const mapLookup =
  (map: Record<string, string[]>): LookupFn =>
  async (host) => {
    const addrs = map[host]
    if (!addrs) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })
    return addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
  }

describe('isBlockedIp', () => {
  const blocked = [
    // IPv4
    '0.0.0.0', '0.1.2.3', '10.0.0.1', '10.255.255.255', '100.64.0.1', '100.127.255.254', '127.0.0.1', '127.255.255.254',
    '169.254.169.254', '169.254.0.1', '172.16.0.1', '172.31.255.255', '192.0.0.1', '192.0.2.5', '192.168.1.1',
    '198.18.0.1', '198.19.255.255', '198.51.100.1', '203.0.113.9', '224.0.0.1', '239.255.255.255', '240.0.0.1',
    '255.255.255.255',
    // IPv6
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'fe80::1ff:fe23:4567:890a', 'febf::1', 'fec0::1', 'ff02::1',
    '[::1]', '100::1', '2001:db8::1', '2001::1', '2001:1::1', '3fff::1', '::2:3',
    // IPv4-mapped / translated / embedded
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe',
    '::ffff:0.0.0.0', '0:0:0:0:0:ffff:192.168.0.1', '64:ff9b::7f00:1', '64:ff9b::10.0.0.1', '2002:7f00:1::1',
    '2002:a9fe:a9fe::1', '::ffff:0:7f00:1',
    // garbage fails closed
    '', 'not-an-ip', '1.2.3', '256.1.1.1', 'fe80::1%eth0',
  ]
  it.each(blocked)('blocks %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true)
  })

  const allowed = [
    PUBLIC_V4, '8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '169.253.1.1',
    '198.17.0.1', '198.20.0.1', '223.255.255.255', '2606:4700:4700::1111', '2a00:1450:4001:81b::200e',
    '::ffff:8.8.8.8', '::ffff:808:808', '64:ff9b::808:808', '2002:808:808::1', '2001:4860:4860::8888',
  ]
  it.each(allowed)('allows %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false)
  })
})

describe('assertPublicUrl', () => {
  const rejected: Array<[string, string]> = [
    ['file scheme', 'file:///etc/passwd'],
    ['ftp scheme', 'ftp://example.com/x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,hi'],
    ['garbage', 'not a url'],
    ['credentials (user:pass)', 'https://user:pass@example.com/'],
    ['credentials (user only)', 'https://user@example.com/'],
    ['localhost', 'http://localhost/'],
    ['localhost with port', 'http://localhost:3000/admin'],
    ['uppercase LOCALHOST', 'http://LOCALHOST/'],
    ['trailing-dot localhost', 'http://localhost./'],
    ['subdomain of localhost', 'http://foo.localhost/'],
    ['.local', 'http://printer.local/'],
    ['.internal', 'http://metadata.google.internal/computeMetadata/v1/'],
    ['single-label host', 'http://metadata/'],
    ['loopback', 'http://127.0.0.1/'],
    ['loopback other', 'http://127.1.2.3:8080/'],
    ['0.0.0.0', 'http://0.0.0.0/'],
    ['0.0.0.0 with port', 'http://0.0.0.0:3000/'],
    ['metadata link-local', 'http://169.254.169.254/latest/meta-data/'],
    ['metadata link-local https', 'https://169.254.169.254/'],
    ['10/8', 'http://10.1.2.3/'],
    ['172.16/12', 'http://172.20.0.5/'],
    ['192.168/16', 'http://192.168.0.1/'],
    ['CGNAT', 'http://100.64.0.1/'],
    ['multicast', 'http://224.0.0.1/'],
    ['reserved 240/4', 'http://240.0.0.1/'],
    ['broadcast', 'http://255.255.255.255/'],
    ['decimal IP', 'http://2130706433/'],
    ['decimal metadata IP', 'http://2852039166/'],
    ['hex IP', 'http://0x7f000001/'],
    ['hex dotted IP', 'http://0x7f.0x0.0x0.0x1/'],
    ['octal IP', 'http://0177.0.0.1/'],
    ['octal dotted metadata', 'http://0251.0376.0251.0376/'],
    ['short IP', 'http://127.1/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IPv6 loopback with port', 'http://[::1]:8080/'],
    ['IPv6 unspecified', 'http://[::]/'],
    ['IPv6 ULA fc00', 'http://[fc00::1]/'],
    ['IPv6 ULA fd', 'http://[fd00:ec2::254]/'],
    ['IPv6 link-local', 'http://[fe80::1]/'],
    ['IPv6 multicast', 'http://[ff02::1]/'],
    ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/'],
    ['IPv4-mapped loopback hex', 'http://[::ffff:7f00:1]/'],
    ['IPv4-mapped metadata', 'http://[::ffff:169.254.169.254]/'],
    ['IPv4-mapped private', 'http://[::ffff:192.168.1.1]/'],
    ['NAT64 loopback', 'http://[64:ff9b::7f00:1]/'],
  ]
  it.each(rejected)('rejects %s', async (_name, url) => {
    // lookup must never be needed to reject these (and must never be called for IP literals)
    await expect(assertPublicUrl(url, failingLookup)).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  const accepted: Array<[string, string]> = [
    ['https public host', 'https://example.com/page'],
    ['http public host with port and query', 'http://example.com:8080/a?b=c'],
    ['public IPv4 literal', `http://${PUBLIC_V4}/`],
    ['public IPv6 literal', 'https://[2606:4700:4700::1111]/'],
    ['public IPv4-mapped literal', 'http://[::ffff:8.8.8.8]/'],
  ]
  it.each(accepted)('accepts %s', async (_name, url) => {
    const url2 = await assertPublicUrl(url, publicLookup)
    expect(url2).toBeInstanceOf(URL)
  })

  it('does not resolve DNS for IP literals', async () => {
    await expect(assertPublicUrl(`http://${PUBLIC_V4}/`, failingLookup)).resolves.toBeInstanceOf(URL)
  })

  it('rejects a DNS name that resolves to a private IPv4 address', async () => {
    const lookup = mapLookup({ 'evil.example.com': ['10.0.0.5'] })
    await expect(assertPublicUrl('https://evil.example.com/', lookup)).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('rejects a DNS name that resolves to loopback, metadata, or 0.0.0.0', async () => {
    for (const address of ['127.0.0.1', '169.254.169.254', '0.0.0.0', '100.64.1.1']) {
      const lookup = mapLookup({ 'evil.example.com': [address] })
      await expect(assertPublicUrl('https://evil.example.com/', lookup)).rejects.toBeInstanceOf(UnsafeUrlError)
    }
  })

  it('rejects a DNS name that resolves to private IPv6 (incl. IPv4-mapped)', async () => {
    for (const address of ['::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
      const lookup = mapLookup({ 'evil.example.com': [address] })
      await expect(assertPublicUrl('https://evil.example.com/', lookup)).rejects.toBeInstanceOf(UnsafeUrlError)
    }
  })

  it('rejects when ANY resolved address is non-public (mixed answers)', async () => {
    const lookup = mapLookup({ 'mixed.example.com': [PUBLIC_V4, '10.0.0.5'] })
    await expect(assertPublicUrl('https://mixed.example.com/', lookup)).rejects.toBeInstanceOf(UnsafeUrlError)
    const lookup6 = mapLookup({ 'mixed.example.com': ['2606:4700:4700::1111', '::1'] })
    await expect(assertPublicUrl('https://mixed.example.com/', lookup6)).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('accepts a DNS name whose addresses are all public (v4 and v6)', async () => {
    const lookup = mapLookup({ 'ok.example.com': [PUBLIC_V4, '2606:4700:4700::1111'] })
    await expect(assertPublicUrl('https://ok.example.com/', lookup)).resolves.toBeInstanceOf(URL)
  })

  it('lowercases the hostname before lookup and strips a trailing dot', async () => {
    const seen: string[] = []
    const lookup: LookupFn = async (h) => {
      seen.push(h)
      return [{ address: PUBLIC_V4, family: 4 }]
    }
    await assertPublicUrl('https://EXAMPLE.com./x', lookup)
    expect(seen).toEqual(['example.com'])
  })

  it('treats resolution failure as a plain Error (not UnsafeUrlError) so the caller can say "could not load"', async () => {
    const err = await assertPublicUrl('https://nope.example.com/', mapLookup({})).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnsafeUrlError)
    expect(String(err)).toMatch(/resolve/i)
  })

  it('treats an empty DNS answer as a resolution failure', async () => {
    const err = await assertPublicUrl('https://nope.example.com/', async () => []).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnsafeUrlError)
  })
})

function redirect(location: string | null, status = 302): Response {
  return new Response(null, { status, headers: location ? { location } : {} })
}

describe('safeFetch', () => {
  it('returns a public response and forces manual redirect handling', async () => {
    const fetchImpl = vi.fn(async () => new Response('hello', { status: 200 }))
    const res = await safeFetch('https://example.com/a', { headers: { 'X-T': '1' } }, { lookup: publicLookup, fetchImpl })
    expect(await res.text()).toBe('hello')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.redirect).toBe('manual')
    expect((init.headers as Record<string, string>)['X-T']).toBe('1')
  })

  it('never calls fetch for a blocked initial URL', async () => {
    const fetchImpl = vi.fn()
    for (const u of ['http://169.254.169.254/', 'http://localhost/', 'http://[::1]/', 'http://0.0.0.0/', 'file:///etc/passwd']) {
      await expect(safeFetch(u, {}, { lookup: failingLookup, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never calls fetch when the host resolves to a private address', async () => {
    const fetchImpl = vi.fn()
    const lookup = mapLookup({ 'rebind.example.com': ['192.168.1.10'] })
    await expect(safeFetch('https://rebind.example.com/', {}, { lookup, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('follows a redirect to another public URL (relative Location supported)', async () => {
    const urls: string[] = []
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      urls.push(String(u))
      return urls.length === 1 ? redirect('/final?x=1', 301) : new Response('final', { status: 200 })
    })
    const res = await safeFetch('https://example.com/start', {}, { lookup: publicLookup, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(await res.text()).toBe('final')
    expect(urls).toEqual(['https://example.com/start', 'https://example.com/final?x=1'])
  })

  it.each([
    ['metadata IP', 'http://169.254.169.254/latest/meta-data/'],
    ['loopback', 'http://127.0.0.1:8080/admin'],
    ['0.0.0.0', 'http://0.0.0.0/'],
    ['localhost', 'http://localhost/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IPv4-mapped', 'http://[::ffff:127.0.0.1]/'],
    ['decimal IP', 'http://2130706433/'],
    ['file scheme', 'file:///etc/passwd'],
    ['credentials', 'http://u:p@example.com/'],
  ])('rejects a redirect to %s without fetching it', async (_n, target) => {
    const urls: string[] = []
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      urls.push(String(u))
      return redirect(target)
    })
    await expect(
      safeFetch('https://example.com/start', {}, { lookup: publicLookup, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(urls).toEqual(['https://example.com/start'])
  })

  it('rejects a redirect to a hostname that resolves to a private address', async () => {
    const lookup = mapLookup({ 'example.com': [PUBLIC_V4], 'internal.example.net': ['10.1.1.1'] })
    const fetchImpl = vi.fn(async () => redirect('https://internal.example.net/'))
    await expect(safeFetch('https://example.com/', {}, { lookup, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('re-validates every hop in a chain (public -> public -> private)', async () => {
    const lookup = mapLookup({ 'a.example.com': [PUBLIC_V4], 'b.example.com': [PUBLIC_V4], 'c.example.com': ['127.0.0.1'] })
    const urls: string[] = []
    const fetchImpl = vi.fn(async (u: string | URL | Request) => {
      urls.push(String(u))
      return redirect(urls.length === 1 ? 'https://b.example.com/' : 'https://c.example.com/')
    })
    await expect(
      safeFetch('https://a.example.com/', {}, { lookup, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(urls).toEqual(['https://a.example.com/', 'https://b.example.com/'])
  })

  it('caps the number of redirects', async () => {
    const fetchImpl = vi.fn(async () => redirect('https://example.com/loop'))
    const err = await safeFetch('https://example.com/loop', {}, { lookup: publicLookup, fetchImpl, maxRedirects: 3 }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnsafeUrlError)
    expect(String(err)).toMatch(/too many redirects/i)
    expect(fetchImpl).toHaveBeenCalledTimes(4) // initial request + 3 followed redirects
  })

  it('allows exactly maxRedirects redirects', async () => {
    let n = 0
    const fetchImpl = vi.fn(async () => (n++ < 3 ? redirect('https://example.com/next') : new Response('ok')))
    const res = await safeFetch('https://example.com/', {}, { lookup: publicLookup, fetchImpl, maxRedirects: 3 })
    expect(await res.text()).toBe('ok')
  })

  it('errors on a redirect without Location', async () => {
    const fetchImpl = vi.fn(async () => redirect(null))
    await expect(safeFetch('https://example.com/', {}, { lookup: publicLookup, fetchImpl })).rejects.toThrow(/Location/)
  })

  it('returns non-redirect error statuses untouched for the caller to handle', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }))
    const res = await safeFetch('https://example.com/', {}, { lookup: publicLookup, fetchImpl })
    expect(res.status).toBe(404)
    expect(res.ok).toBe(false)
  })

  it('does not treat 304 as a redirect', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 304, headers: { location: 'http://127.0.0.1/' } }))
    const res = await safeFetch('https://example.com/', {}, { lookup: publicLookup, fetchImpl })
    expect(res.status).toBe(304)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('readTextCapped', () => {
  it('returns the full body when under the cap', async () => {
    expect(await readTextCapped(new Response('hello world'), 1000)).toBe('hello world')
  })

  it('truncates at the byte cap without erroring', async () => {
    expect(await readTextCapped(new Response('abcdefghij'), 4)).toBe('abcd')
  })

  it('stops reading a large streamed body once the cap is reached', async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(new TextEncoder().encode('x'.repeat(1024)))
        if (pulled > 10_000) controller.close()
      },
    })
    const text = await readTextCapped(new Response(stream), 4096)
    expect(text.length).toBe(4096)
    expect(pulled).toBeLessThan(50)
  })
})
