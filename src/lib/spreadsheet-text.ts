import ExcelJS from 'exceljs'

// Turns an uploaded .xlsx or .csv into plain text (one block per sheet, one line per row) for the
// formulation reader. SERVER ONLY. Old binary .xls files aren't readable; people re-save them.

const MAX_ROWS = 400
const MAX_COLS = 40
export const MAX_SHEET_TEXT = 300_000 // characters across all sheets

export class SpreadsheetError extends Error {}

export type SheetText = { name: string; text: string; rows: number }

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('result' in v) return cellText((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('')
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text)
    if ('error' in v) return ''
    return ''
  }
  return String(v)
}

// Quote like CSV only when needed, so the text stays easy to read
const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export async function spreadsheetToText(bytes: Buffer, fileName: string): Promise<SheetText[]> {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'xls') throw new SpreadsheetError('Old .xls files can’t be read. Open it in Excel and save it as .xlsx or .csv, then upload that.')

  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    const text = bytes.toString('utf8').replace(/^﻿/, '')
    const lines = text.split(/\r?\n/).slice(0, MAX_ROWS)
    const numbered = lines.map((l, i) => (l.trim() ? `R${i + 1}: ${l}` : '')).filter(Boolean).join('\n')
    if (!numbered) throw new SpreadsheetError('That file is empty.')
    return [{ name: fileName, text: numbered, rows: lines.length }]
  }

  if (ext !== 'xlsx' && ext !== 'xlsm') {
    throw new SpreadsheetError('Upload an Excel workbook (.xlsx) or a CSV file.')
  }

  const wb = new ExcelJS.Workbook()
  try {
    // exceljs types its Buffer argument loosely; the Node Buffer is what it reads
    await wb.xlsx.load(bytes as unknown as ArrayBuffer)
  } catch {
    throw new SpreadsheetError('That workbook couldn’t be opened. Check it opens in Excel, or save it as .csv and try again.')
  }

  const sheets: SheetText[] = []
  wb.eachSheet(ws => {
    if (ws.state !== 'visible') return
    const out: string[] = []
    let rows = 0
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) return
      const cells: string[] = []
      for (let c = 1; c <= Math.min(row.cellCount, MAX_COLS); c++) cells.push(csvCell(cellText(row.getCell(c).value).trim()))
      while (cells.length && !cells[cells.length - 1]) cells.pop()
      if (cells.length) {
        out.push(`R${rowNumber}: ${cells.join(',')}`)
        rows++
      }
    })
    if (rows > 0) sheets.push({ name: ws.name, text: out.join('\n'), rows })
  })
  if (sheets.length === 0) throw new SpreadsheetError('That workbook has no data in its visible sheets.')
  return sheets
}
