import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { fitsOnPage, type Block, type Column, type Report } from './model'
import { pdfSafe } from './pdf-text'

// No hyphenation: it splits emails, codes and ingredient names ("alp-bio.com"). Only a token too long for
// a column (a long URL; IDs are 36 characters) may break, after a / ? & or - where it has one, so it can't
// run off the page. react-pdf draws a hyphen at such a break.
function breakPoints(word: string): string[] {
  if (word.length <= 40) return [word]
  const parts = word.split(/(?<=[/?&-])/)
  return parts.flatMap(p => (p.length <= 30 ? [p] : p.match(/.{1,24}/g) ?? [p]))
}
Font.registerHyphenationCallback(breakPoints)

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 50, fontFamily: 'Helvetica', fontSize: 9.5, color: '#111827' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  titleOnly: { marginBottom: 14 },
  subtitle: { fontSize: 10, color: '#6B7280', marginBottom: 16 },
  h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 6 },
  h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 5, color: '#1F2937' },
  h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 9, marginBottom: 3, color: '#374151' },
  pBox: { marginBottom: 6 },
  // Font size set here, not inherited from the page: inherited, react-pdf spaces wrapped lines far apart
  p: { fontSize: 9.5, lineHeight: 1.35 },
  muted: { color: '#6B7280' },
  mono: { fontFamily: 'Courier', fontSize: 8.5 },
  bulletRow: { flexDirection: 'row', marginBottom: 2 },
  bulletMark: { width: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 2 },
  fieldLabel: { width: '28%', color: '#6B7280', paddingRight: 8 },
  fieldValue: { width: '72%' },
  fields: { marginBottom: 8 },
  tableTop: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: '#D1D5DB' },
  tableEnd: { marginBottom: 8 },
  // Left border on each row, not the table: a table's own border runs on to the page foot when a row moves on
  row: { flexDirection: 'row', borderLeftWidth: 0.5, borderColor: '#D1D5DB' },
  headRow: { flexDirection: 'row', backgroundColor: '#EFF1F4' },
  cell: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#D1D5DB', paddingVertical: 2.5, paddingHorizontal: 4, fontSize: 8.5, lineHeight: 1.3 },
  headCell: { fontFamily: 'Helvetica-Bold' },
  // Line height is set per text style, never on the page: inherited into this fixed, absolutely placed footer
  // it sends react-pdf's layout off the rails on some pages ("unsupported number: -7.57e+21")
  footer: { position: 'absolute', bottom: 26, left: 50, right: 50, fontSize: 8, color: '#9CA3AF', textAlign: 'right' },
})

function TableView({ columns, rows, lead }: { columns: Column[]; rows: string[][]; lead?: React.ReactNode }) {
  const total = columns.reduce((sum, c) => sum + (c.width ?? 1), 0)
  const width = (c: Column) => `${((c.width ?? 1) / total) * 100}%`
  const row = (r: string[], key: number) => (
    <View key={key} style={s.row} wrap={!fitsOnPage(r)}>
      {columns.map((c, i) => (
        <Text key={i} style={[s.cell, { width: width(c), textAlign: c.numeric ? 'right' : 'left' }]}>{pdfSafe(r[i] ?? '')}</Text>
      ))}
    </View>
  )
  const keepFirst = rows.length > 0 && fitsOnPage(rows[0])
  return (
    <View>
      {/* The heading, header row and first row stay together, so a table never starts as a bare header at a page foot */}
      <View wrap={false}>
        {lead}
        <View style={[s.headRow, s.tableTop]}>
          {columns.map((c, i) => (
            <Text key={i} style={[s.cell, s.headCell, { width: width(c), textAlign: c.numeric ? 'right' : 'left' }]}>{pdfSafe(c.label)}</Text>
          ))}
        </View>
        {keepFirst && row(rows[0], 0)}
      </View>
      <View style={s.tableEnd}>{rows.slice(keepFirst ? 1 : 0).map((r, i) => row(r, i + (keepFirst ? 1 : 0)))}</View>
    </View>
  )
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'h1': return <Text style={s.h1}>{pdfSafe(b.text)}</Text>
    case 'h2': return <Text style={s.h2}>{pdfSafe(b.text)}</Text>
    case 'h3': return <Text style={s.h3}>{pdfSafe(b.text)}</Text>
    case 'p': return <View style={s.pBox}><Text style={[s.p, ...(b.muted ? [s.muted] : []), ...(b.mono ? [s.mono] : [])]}>{pdfSafe(b.text)}</Text></View>
    case 'bullets':
      return (
        <View style={s.p}>
          {b.items.map((item, i) => (
            <View key={i} style={s.bulletRow} wrap={!fitsOnPage([item])}>
              <Text style={s.bulletMark}>{b.numbered ? `${i + 1}.` : '•'}</Text>
              <Text style={{ flex: 1 }}>{pdfSafe(item)}</Text>
            </View>
          ))}
        </View>
      )
    case 'fields':
      return (
        <View style={s.fields}>
          {b.fields.map(([label, value], i) => (
            <View key={i} style={s.fieldRow} wrap={!fitsOnPage([value])}>
              <Text style={s.fieldLabel}>{pdfSafe(label)}</Text>
              <Text style={s.fieldValue}>{pdfSafe(value)}</Text>
            </View>
          ))}
        </View>
      )
    case 'table':
      return b.rows.length
        ? <TableView columns={b.columns} rows={b.rows} />
        : <Text style={[s.p, s.muted]}>{pdfSafe(b.emptyText ?? 'None.')}</Text>
    case 'pagebreak': return null // each starts a new <Page>; see renderPdf
  }
}

const isHeading = (b: Block | undefined) => b?.t === 'h1' || b?.t === 'h2' || b?.t === 'h3'
/** Short enough to keep on the same page as the heading above it */
const keepable = (b: Block | undefined) =>
  (b?.t === 'p' && b.text.length < 600) || (b?.t === 'bullets' && b.items.length <= 4) || (b?.t === 'fields' && b.fields.length <= 6 && fitsOnPage(b.fields.map(f => f[1])))

/**
 * A run of blocks laid out for react-pdf: a heading stays on the page of what follows it
 * (a table's header and first row, or a short block).
 */
function pdfBlocks(blocks: Block[]) {
  const out: React.ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const next = blocks[i + 1]
    if (isHeading(b) && next?.t === 'table' && next.rows.length) {
      out.push(<TableView key={i} columns={next.columns} rows={next.rows} lead={<BlockView b={b} />} />)
      i++
    } else if (isHeading(b) && keepable(next)) {
      out.push(<View key={i} wrap={false}><BlockView b={b} /><BlockView b={next!} /></View>)
      i++
    } else {
      out.push(<BlockView key={i} b={b} />)
    }
  }
  return out
}

/** The blocks between page breaks */
function splitPages(blocks: Block[]): Block[][] {
  const pages: Block[][] = [[]]
  for (const b of blocks) {
    if (b.t === 'pagebreak') { if (pages[pages.length - 1].length) pages.push([]) }
    else pages[pages.length - 1].push(b)
  }
  return pages
}

/**
 * Each page break starts a new <Page>. Laying out one long page run gets slower the longer it is
 * (every ingredient in one run took over a minute), and an empty <View break /> can send react-pdf's
 * layout off the rails ("unsupported number: -7e21").
 */
export async function renderPdf(report: Report): Promise<Buffer> {
  const footer = (
    <Text
      style={s.footer}
      fixed
      render={({ pageNumber, totalPages }) => pdfSafe(`${report.title} · Benchtop · Page ${pageNumber} of ${totalPages}`)}
    />
  )
  return renderToBuffer(
    <Document title={pdfSafe(report.title)} creator="Benchtop" producer="Benchtop">
      {splitPages(report.blocks).map((blocks, i) => (
        <Page key={i} size="LETTER" style={s.page} wrap>
          {i === 0 && <Text style={[s.title, ...(report.subtitle ? [] : [s.titleOnly])]}>{pdfSafe(report.title)}</Text>}
          {i === 0 && report.subtitle ? <Text style={s.subtitle}>{pdfSafe(report.subtitle)}</Text> : null}
          {pdfBlocks(blocks)}
          {footer}
        </Page>
      ))}
    </Document>,
  )
}
