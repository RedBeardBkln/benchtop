import type { HelpBlock, HelpSection } from './types'

export type HelpHit = {
  section: string
  sectionTitle: string
  /** Article slug, or null for an FAQ */
  anchor: string
  title: string
  snippet: string
  kind: 'article' | 'faq'
  score: number
}

/** Inline markup → plain text: [label](href) → label, **x** → x, `x` → x */
export function plainText(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
}

function blockText(b: HelpBlock): string {
  switch (b.type) {
    case 'steps':
    case 'list':
      return b.items.join(' ')
    case 'terms':
      return b.items.map(i => `${i.term} ${i.text}`).join(' ')
    default:
      return b.text
  }
}

/** Stable anchor for an FAQ on its section page */
export function faqAnchor(index: number): string {
  return `faq-${index + 1}`
}

function snippetAround(text: string, words: string[], len = 160): string {
  const lower = text.toLowerCase()
  const at = words.map(w => lower.indexOf(w)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, at - 50)
  const out = text.slice(start, start + len).trim()
  return (start > 0 ? '…' : '') + out + (start + len < text.length ? '…' : '')
}

/**
 * Every word of the query must appear somewhere in the article or FAQ. Title matches outrank
 * body matches. Returns the best `limit` hits.
 */
export function searchHelp(sections: HelpSection[], query: string, limit = 20): HelpHit[] {
  const words = query.toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}%$-]/gu, '')).filter(w => w.length > 1)
  if (words.length === 0) return []

  const hits: HelpHit[] = []
  const score = (title: string, body: string): number => {
    const t = title.toLowerCase()
    const b = body.toLowerCase()
    let s = 0
    for (const w of words) {
      const inTitle = t.includes(w)
      if (!inTitle && !b.includes(w)) return 0
      s += inTitle ? 5 : 1
    }
    return s
  }

  for (const sec of sections) {
    for (const a of sec.articles) {
      const body = plainText([a.summary, ...a.blocks.map(blockText)].join(' '))
      const s = score(a.title, body)
      if (s > 0) {
        hits.push({
          section: sec.slug, sectionTitle: sec.title, anchor: a.slug, title: a.title,
          snippet: snippetAround(body, words), kind: 'article', score: s,
        })
      }
    }
    sec.faqs.forEach((f, i) => {
      const body = plainText(f.a)
      const s = score(f.q, body)
      if (s > 0) {
        hits.push({
          section: sec.slug, sectionTitle: sec.title, anchor: faqAnchor(i), title: f.q,
          snippet: snippetAround(body, words), kind: 'faq', score: s,
        })
      }
    })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
