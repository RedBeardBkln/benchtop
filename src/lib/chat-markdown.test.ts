import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './chat-markdown'

describe('parseInline', () => {
  it('reads bold, italic, code and links', () => {
    expect(parseInline('Use **0.2%** *gellan* with `pH 4.2` [see FDA](https://fda.gov)')).toEqual([
      { t: 'text', v: 'Use ' },
      { t: 'strong', c: [{ t: 'text', v: '0.2%' }] },
      { t: 'text', v: ' ' },
      { t: 'em', c: [{ t: 'text', v: 'gellan' }] },
      { t: 'text', v: ' with ' },
      { t: 'code', v: 'pH 4.2' },
      { t: 'text', v: ' ' },
      { t: 'link', href: 'https://fda.gov', c: [{ t: 'text', v: 'see FDA' }] },
    ])
  })

  it('drops unsafe link targets but keeps their text', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ t: 'text', v: 'click' }, { t: 'text', v: ')' }])
  })

  it('leaves underscores inside words alone', () => {
    expect(parseInline('snake_case_name')).toEqual([{ t: 'text', v: 'snake_case_name' }])
  })

  it('links bare URLs without trailing punctuation', () => {
    expect(parseInline('See https://example.com/a.')).toEqual([
      { t: 'text', v: 'See ' },
      { t: 'link', href: 'https://example.com/a', c: [{ t: 'text', v: 'https://example.com/a' }] },
      { t: 'text', v: '.' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and lists', () => {
    const blocks = parseMarkdown('## Options\nTwo ways\nto go.\n\n- Inulin\n- Allulose\n\n1. Hydrate\n2. Heat')
    expect(blocks.map(b => b.t)).toEqual(['h', 'p', 'ul', 'ol'])
    expect(blocks[1]).toEqual({ t: 'p', c: [{ t: 'text', v: 'Two ways to go.' }] })
    expect(blocks[2]).toMatchObject({ items: [[{ t: 'text', v: 'Inulin' }], [{ t: 'text', v: 'Allulose' }]] })
    expect(blocks[3]).toMatchObject({ start: 1 })
  })

  it('reads pipe tables', () => {
    const [table] = parseMarkdown('| Gum | Use % |\n|---|---:|\n| Xanthan | 0.1–0.3 |\n| Guar | 0.2–0.5 |')
    expect(table.t).toBe('table')
    if (table.t !== 'table') return
    expect(table.head).toHaveLength(2)
    expect(table.rows).toHaveLength(2)
    expect(table.rows[1][0]).toEqual([{ t: 'text', v: 'Guar' }])
  })

  it('keeps fenced code as is', () => {
    expect(parseMarkdown('```\n**not bold**\n```')).toEqual([{ t: 'code', v: '**not bold**' }])
  })

  it('folds indented lines into the list item above', () => {
    const [list] = parseMarkdown('- Sweeteners\n  - allulose\n- Fibers')
    expect(list).toMatchObject({ t: 'ul' })
    if (list.t !== 'ul') return
    expect(list.items).toHaveLength(2)
    expect(list.items[0]).toEqual([{ t: 'text', v: 'Sweeteners — allulose' }])
  })
})
