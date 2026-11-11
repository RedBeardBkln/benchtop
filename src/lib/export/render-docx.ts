import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageBreak, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { fitsOnPage, type Block, type Column, type Report } from './model'
import { xmlSafe } from './pdf-text'

// US Letter portrait with 0.75" margins: 7" of text width, in twentieths of a point
const TEXT_WIDTH = 7 * 1440
const GRAY = '6B7280'
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' }

/** Text with line breaks kept */
function runs(text: string, opts: { bold?: boolean; color?: string; size?: number; font?: string } = {}): TextRun[] {
  return xmlSafe(text).split('\n').map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined, ...opts }))
}

function tableOf(columns: Column[], rows: string[][]): Table {
  const total = columns.reduce((s, c) => s + (c.width ?? 1), 0)
  const widths = columns.map(c => Math.round(((c.width ?? 1) / total) * TEXT_WIDTH))
  const cell = (text: string, i: number, header: boolean) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: 'EFF1F4', color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: columns[i]?.numeric ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: runs(text, { bold: header, size: 17 }),
    })],
  })
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: columns.map((c, i) => cell(c.label, i, true)) }),
      ...rows.map(r => new TableRow({ cantSplit: fitsOnPage(r), children: columns.map((_, i) => cell(r[i] ?? '', i, false)) })),
    ],
  })
}

function blockToDocx(b: Block): Array<Paragraph | Table> {
  switch (b.t) {
    case 'h1': return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(b.text) })]
    case 'h2': return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(b.text) })]
    case 'h3': return [new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(b.text) })]
    case 'p': return [new Paragraph({
      spacing: { after: 120 },
      children: runs(b.text, { color: b.muted ? GRAY : undefined, font: b.mono ? 'Consolas' : undefined, size: b.mono ? 18 : undefined }),
    })]
    case 'bullets': return b.items.map(item => new Paragraph({
      numbering: { reference: b.numbered ? 'numbers' : 'bullets', level: 0 },
      children: runs(item),
    }))
    case 'fields': return [new Table({
      width: { size: TEXT_WIDTH, type: WidthType.DXA },
      columnWidths: [Math.round(TEXT_WIDTH * 0.28), Math.round(TEXT_WIDTH * 0.72)],
      borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
      rows: b.fields.map(([label, value]) => new TableRow({
        cantSplit: fitsOnPage([value]),
        children: [
          new TableCell({ width: { size: Math.round(TEXT_WIDTH * 0.28), type: WidthType.DXA }, margins: { top: 20, bottom: 20, right: 120 }, children: [new Paragraph({ children: runs(label, { color: GRAY, size: 19 }) })] }),
          new TableCell({ width: { size: Math.round(TEXT_WIDTH * 0.72), type: WidthType.DXA }, margins: { top: 20, bottom: 20 }, children: [new Paragraph({ children: runs(value, { size: 19 }) })] }),
        ],
      })),
    }), new Paragraph({ children: [] })]
    case 'table':
      if (!b.rows.length) return [new Paragraph({ spacing: { after: 120 }, children: runs(b.emptyText ?? 'None.', { color: GRAY }) })]
      return [tableOf(b.columns, b.rows), new Paragraph({ children: [] })]
    case 'pagebreak': return [new Paragraph({ children: [new PageBreak()] })]
  }
}

export async function renderDocx(report: Report): Promise<Buffer> {
  const doc = new Document({
    creator: 'Benchtop',
    title: report.title,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 20 } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 40, bold: true, color: '111827' }, paragraph: { spacing: { after: 60 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: '111827' }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '1F2937' }, paragraph: { spacing: { before: 260, after: 100 }, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 21, bold: true, color: '374151' }, paragraph: { spacing: { before: 180, after: 60 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `${report.title} · Benchtop · Page `, color: GRAY, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: GRAY, size: 16 }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: runs(report.title) }),
        ...(report.subtitle ? [new Paragraph({ spacing: { after: 240 }, children: runs(report.subtitle, { color: GRAY }) })] : []),
        ...report.blocks.flatMap(blockToDocx),
      ],
    }],
  })
  return Packer.toBuffer(doc)
}
