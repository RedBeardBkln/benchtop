// A small Markdown parser for Sous Chef replies: headings, paragraphs, bulleted and numbered lists,
// pipe tables, fenced code, quotes and rules, with **bold**, *italic*, `code` and [links](url) inline.
// It produces plain data that the chat renders as React elements, so no HTML string is ever injected.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }

export type MdBlock =
  | { t: 'h'; level: 1 | 2 | 3; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][]; start?: number }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'code'; v: string }
  | { t: 'quote'; c: Inline[] }
  | { t: 'hr' }

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = () => { if (text) { out.push({ t: 'text', v: text }); text = '' } }
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    let m: RegExpMatchArray | null
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush(); out.push({ t: 'code', v: m[1] }); i += m[0].length; continue
    }
    if ((m = rest.match(/^\*\*(.+?)\*\*/)) || (m = rest.match(/^__(.+?)__/))) {
      flush(); out.push({ t: 'strong', c: parseInline(m[1]) }); i += m[0].length; continue
    }
    if ((m = rest.match(/^\*(?!\s)([^*]+?)\*/)) || (m = rest.match(/^_(?!\s)([^_]+?)_(?![A-Za-z0-9])/))) {
      // An underscore inside a word (snake_case) isn't emphasis
      if (m[0][0] === '*' || !/[A-Za-z0-9]/.test(src[i - 1] ?? '')) {
        flush(); out.push({ t: 'em', c: parseInline(m[1]) }); i += m[0].length; continue
      }
    }
    if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush()
      if (SAFE_HREF.test(m[2])) out.push({ t: 'link', href: m[2], c: parseInline(m[1]) })
      else out.push(...parseInline(m[1]))
      i += m[0].length; continue
    }
    if ((m = rest.match(/^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/))) {
      flush(); out.push({ t: 'link', href: m[0], c: [{ t: 'text', v: m[0] }] }); i += m[0].length; continue
    }
    text += src[i]
    i++
  }
  flush()
  return out
}

const splitRow = (line: string) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
const isTableRule = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/

export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length) { blocks.push({ t: 'p', c: parseInline(para.join(' ')) }); para = [] }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let m: RegExpMatchArray | null

    if (/^\s*```/.test(line)) {
      flushPara()
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      blocks.push({ t: 'code', v: code.join('\n') })
      continue
    }
    if (!line.trim()) { flushPara(); continue }
    if ((m = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      flushPara()
      blocks.push({ t: 'h', level: Math.min(3, m[1].length) as 1 | 2 | 3, c: parseInline(m[2]) })
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); blocks.push({ t: 'hr' }); continue }
    if (line.includes('|') && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      flushPara()
      const head = splitRow(line).map(parseInline)
      const rows: Inline[][][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]).map(parseInline))
      i--
      blocks.push({ t: 'table', head, rows })
      continue
    }
    if ((m = line.match(/^\s*>\s?(.*)$/))) {
      flushPara()
      const quote = [m[1]]
      while (i + 1 < lines.length && (m = lines[i + 1].match(/^\s*>\s?(.*)$/))) { quote.push(m[1]); i++ }
      blocks.push({ t: 'quote', c: parseInline(quote.join(' ')) })
      continue
    }
    const bullet = line.match(BULLET)
    const numbered = bullet ? null : line.match(NUMBERED)
    if (bullet || numbered) {
      flushPara()
      const ordered = !!numbered
      const pattern = ordered ? NUMBERED : BULLET
      const items: string[] = []
      for (; i < lines.length; i++) {
        const l = lines[i]
        const im = l.match(pattern)
        // An indented line continues the item above it (nested lists are flattened into it)
        if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1] += ` ${l.trim().replace(/^([-*+]|\d+[.)])\s+/, '— ')}`
        else if (im) items.push(ordered ? im[2] : im[1])
        else break
      }
      i--
      blocks.push(ordered
        ? { t: 'ol', items: items.map(parseInline), start: Number(numbered![1]) }
        : { t: 'ul', items: items.map(parseInline) })
      continue
    }
    para.push(line.trim())
  }
  flushPara()
  return blocks
}
