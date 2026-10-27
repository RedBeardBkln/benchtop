import { describe, expect, it } from 'vitest'
import { isAccountLogoPath, logoContentType, logoUrl, newLogoPath, resolveBranding, sniffLogoType } from './logo'

const ACC = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'

describe('sniffLogoType', () => {
  it('reads PNG, JPEG and WEBP from their magic bytes', () => {
    expect(sniffLogoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    expect(sniffLogoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffLogoType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
  })

  it('refuses anything else, SVG and GIF included', () => {
    expect(sniffLogoType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(sniffLogoType(new TextEncoder().encode('GIF89a'))).toBeNull()
    expect(sniffLogoType(new Uint8Array([]))).toBeNull()
  })
})

describe('logo paths', () => {
  it('puts own and team logos in the account branding folder', () => {
    expect(newLogoPath(ACC, 'own', USER, 'image/png', 5)).toBe(`${ACC}/_branding/user-${USER}-5.png`)
    expect(newLogoPath(ACC, 'team', USER, 'image/jpeg', 6)).toBe(`${ACC}/_branding/team-6.jpg`)
  })

  it('accepts only this account’s branding files', () => {
    expect(isAccountLogoPath(ACC, `${ACC}/_branding/team-6.jpg`)).toBe(true)
    expect(isAccountLogoPath(ACC, `${USER}/_branding/team-6.jpg`)).toBe(false)
    expect(isAccountLogoPath(ACC, `${ACC}/_branding/`)).toBe(false)
    expect(isAccountLogoPath(ACC, `${ACC}/_branding/../x.png`)).toBe(false)
    expect(isAccountLogoPath(ACC, null)).toBe(false)
  })

  it('maps the extension back to a content type', () => {
    expect(logoContentType('a/b/team-1.jpg')).toBe('image/jpeg')
    expect(logoContentType('a/b/team-1.webp')).toBe('image/webp')
    expect(logoContentType('a/b/team-1.svg')).toBeNull()
  })

  it('gives each file its own cache-busting URL', () => {
    expect(logoUrl('team', `${ACC}/_branding/team-6.jpg`)).toBe('/api/branding/logo?scope=team&v=team-6')
  })
})

describe('resolveBranding', () => {
  const own = `${ACC}/_branding/user-${USER}-1.png`
  const team = `${ACC}/_branding/team-2.png`

  it('uses the team logo over the user’s own', () => {
    expect(resolveBranding(ACC, own, team).logoUrl).toBe(logoUrl('team', team))
  })

  it('falls back to the user’s own logo, then none', () => {
    expect(resolveBranding(ACC, own, null).logoUrl).toBe(logoUrl('own', own))
    expect(resolveBranding(ACC, null, null)).toEqual({ logoUrl: null, own: null, team: null })
  })

  it('ignores a logo stored under another account', () => {
    expect(resolveBranding(ACC, `${USER}/_branding/user-x-1.png`, null).logoUrl).toBeNull()
  })
})
