import ExcelJS from 'exceljs'
import type { Cell, Sheet, SectionSheet, Workbook } from './model'
import { xmlSafe } from './pdf-text'

// Excel caps a cell at 32,767 characters and a sheet name at 31 (and bans a few characters in it)
const MAX_CELL_CHARS = 32000
const sheetName = (s: string) => xmlSafe(s).replace(/[[\]:*?/\\]/g, '-').slice(0, 31)
const DATE_FMT = 'yyyy-mm-dd hh:mm'
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF1F4' } }
const MAX_WIDTH = 60

function cellValue(v: Cell): ExcelJS.CellValue {
  if (v == null || v === '') return null
  if (typeof v === 'string') {
    const t = xmlSafe(v)
    return t.length > MAX_CELL_CHARS ? `${t.slice(0, MAX_CELL_CHARS)}…` : t
  }
  // Round away floating-point noise (8.1084488000000001); 6 decimals keeps trace mcg values
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null
  return v
}

/** Display width of a value, for sizing its column */
function widthOf(v: Cell): number {
  if (v == null) return 0
  if (v instanceof Date) return 17
  if (typeof v === 'number') return Math.min(String(Math.round(v * 1000) / 1000).length + 1, 14)
  const s = String(v)
  return Math.max(...s.split('\n').map(l => l.length))
}

/** A sheet that is one filterable table */
function addTableSheet(wb: ExcelJS.Workbook, sheet: Sheet) {
  const ws = wb.addWorksheet(sheetName(sheet.name), { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = sheet.columns.map((c, i) => {
    const contentWidth = Math.max(widthOf(c.label), ...sheet.rows.slice(0, 500).map(r => widthOf(r[i])))
    return { header: c.label, width: Math.min(Math.max(contentWidth + 2, 8), MAX_WIDTH) }
  })
  for (const row of sheet.rows) ws.addRow(row.map(cellValue))

  const header = ws.getRow(1)
  header.font = { bold: true }
  header.fill = HEADER_FILL
  header.alignment = { vertical: 'middle' }
  if (sheet.columns.length) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } }
  }

  // Dates as dates, long text wrapped so it can be read without widening the column
  ws.columns.forEach((column, i) => {
    const sample = sheet.rows.find(r => r[i] != null)?.[i]
    if (sample instanceof Date) column.numFmt = DATE_FMT
    if ((column.width ?? 0) >= MAX_WIDTH) column.alignment = { wrapText: true, vertical: 'top' }
  })
}

/** A sheet laid out like a page: title, label/value fields, then titled tables one under another */
function addSectionSheet(wb: ExcelJS.Workbook, sheet: SectionSheet) {
  const ws = wb.addWorksheet(sheetName(sheet.name))
  const widths: number[] = []
  const track = (col: number, v: Cell) => { widths[col] = Math.max(widths[col] ?? 0, widthOf(v)) }
  let r = 1

  const put = (row: number, col: number, v: Cell, style?: Partial<ExcelJS.Style>) => {
    const cell = ws.getCell(row, col)
    cell.value = cellValue(v)
    if (v instanceof Date) cell.numFmt = DATE_FMT
    if (typeof v === 'string' && v.length > MAX_WIDTH) cell.alignment = { wrapText: true, vertical: 'top' }
    if (style) Object.assign(cell, style)
    track(col, v)
  }

  for (const s of sheet.sections) {
    if (s.t === 'title') {
      ws.getCell(r, 1).value = xmlSafe(s.text)
      ws.getCell(r, 1).font = { bold: true, size: 14 }
      r += 2
    } else if (s.t === 'fields') {
      // Empty fields are left out, as on a printed page
      for (const [label, value] of s.fields.filter(([, v]) => v != null && v !== '')) {
        put(r, 1, label, { font: { color: { argb: 'FF6B7280' } } })
        put(r, 2, value)
        r++
      }
      r++
    } else {
      ws.getCell(r, 1).value = xmlSafe(s.title)
      ws.getCell(r, 1).font = { bold: true, size: 12 }
      r++
      if (!s.rows.length) {
        ws.getCell(r, 1).value = s.emptyText ?? 'None.'
        ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF6B7280' } }
        r += 2
        continue
      }
      s.columns.forEach((c, i) => put(r, i + 1, c.label, { font: { bold: true }, fill: HEADER_FILL }))
      r++
      for (const row of s.rows) {
        row.forEach((v, i) => put(r, i + 1, v))
        r++
      }
      r++
    }
  }

  for (let col = 2; col < widths.length; col++) ws.getColumn(col).width = Math.min(Math.max((widths[col] ?? 0) + 2, 10), MAX_WIDTH)
  // Column A holds the field labels and the first table column; give it room for both
  ws.getColumn(1).width = Math.min(Math.max(widths[1] ?? 0, 18) + 2, 34)
}

export async function renderWorkbook(book: Workbook): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Benchtop'
  wb.created = new Date()
  for (const sheet of book.sheets) {
    if ('sections' in sheet) addSectionSheet(wb, sheet)
    else addTableSheet(wb, sheet)
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
