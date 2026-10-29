import { describe, expect, it } from 'vitest'
import { HELP_SECTIONS, POPULAR_QUESTIONS } from './index'
import { faqAnchor, plainText, searchHelp } from './search'
import type { HelpBlock } from './types'

const blockTexts = (b: HelpBlock): string[] =>
  b.type === 'steps' || b.type === 'list' ? b.items
    : b.type === 'terms' ? b.items.flatMap(i => [i.term, i.text])
      : [b.text]

// Every piece of inline text in the help center, with where it lives
const allTexts = HELP_SECTIONS.flatMap(sec => [
  { sec: sec.slug, text: sec.intro },
  ...sec.articles.flatMap(a => [a.summary, ...a.blocks.flatMap(blockTexts)].map(text => ({ sec: sec.slug, text }))),
  ...sec.faqs.flatMap(f => [f.q, f.a].map(text => ({ sec: sec.slug, text }))),
])

// App pages help may link to (dynamic record pages can't be linked from static help)
const APP_ROUTES = new Set([
  '/projects', '/clients', '/ingredients', '/suppliers', '/login', '/forgot-password',
  '/settings', '/settings/profile', '/settings/preferences', '/settings/account', '/settings/team',
  '/settings/billing', '/settings/privacy', '/legal/terms', '/legal/privacy', '/help', '/time', '/sous-chef',
])

describe('help content', () => {
  it('has unique section, article and anchor slugs', () => {
    const sections = HELP_SECTIONS.map(s => s.slug)
    expect(new Set(sections).size).toBe(sections.length)
    for (const s of HELP_SECTIONS) {
      const anchors = s.articles.map(a => a.slug)
      expect(new Set(anchors).size, s.slug).toBe(anchors.length)
      expect(anchors.some(a => a === 'faq' || a.startsWith('faq-')), s.slug).toBe(false)
    }
  })

  it('only links to pages and help anchors that exist', () => {
    const broken: string[] = []
    for (const { sec, text } of allTexts) {
      for (const [, href] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const [path, hash] = href.split('#')
        const target = path === '' ? sec : path.startsWith('/help/') ? path.slice(6) : null
        if (target != null) {
          const s = HELP_SECTIONS.find(x => x.slug === target)
          const ok = s && (!hash || hash === 'faq' || s.articles.some(a => a.slug === hash)
            || s.faqs.some((_, i) => faqAnchor(i) === hash))
          if (!ok) broken.push(`${sec}: ${href}`)
        } else if (!APP_ROUTES.has(path)) {
          broken.push(`${sec}: ${href}`)
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('has balanced inline markup', () => {
    for (const { sec, text } of allTexts) {
      expect((text.match(/\*\*/g) ?? []).length % 2, `${sec}: ${text}`).toBe(0)
      expect((text.match(/`/g) ?? []).length % 2, `${sec}: ${text}`).toBe(0)
    }
  })

  it('popular questions all exist', () => {
    for (const p of POPULAR_QUESTIONS) {
      const sec = HELP_SECTIONS.find(s => s.slug === p.section)
      expect(sec?.faqs.some(f => f.q === p.q), p.q).toBe(true)
    }
  })
})

describe('searchHelp', () => {
  it('finds guides and FAQs, ranking title matches first', () => {
    const hits = searchHelp(HELP_SECTIONS, 'nutrition facts')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].title.toLowerCase()).toContain('nutrition facts')
  })
  it('needs every word to match', () => {
    expect(searchHelp(HELP_SECTIONS, 'invite zzqqxx')).toEqual([])
    expect(searchHelp(HELP_SECTIONS, 'x')).toEqual([])
  })
  it('strips markup for display', () => {
    expect(plainText('Click `Save` on [Settings](/settings) **now**')).toBe('Click Save on Settings now')
  })
})
