import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { SpreadsheetError, spreadsheetToText } from './spreadsheet-text'

async function workbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Oat Bar')
  ws.addRow(['Ingredient', 'Grams', '%'])
  ws.addRow(['Rolled oats, organic', 600, { formula: 'B2/B4*100', result: 60 }])
  ws.addRow(['Honey', 400, { formula: 'B3/B4*100', result: 40 }])
  ws.addRow(['Total', { formula: 'SUM(B2:B3)', result: 1000 }])
  const hidden = wb.addWorksheet('Costs')
  hidden.state = 'hidden'
  hidden.addRow(['secret', 1])
  wb.addWorksheet('Empty')
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('spreadsheetToText', () => {
  it('reads visible sheets row by row, using formula results and quoting commas', async () => {
    const sheets = await spreadsheetToText(await workbook(), 'bar.xlsx')
    expect(sheets.map(s => s.name)).toEqual(['Oat Bar'])
    expect(sheets[0].text).toBe([
      'R1: Ingredient,Grams,%',
      'R2: "Rolled oats, organic",600,60',
      'R3: Honey,400,40',
      'R4: Total,1000',
    ].join('\n'))
  })

  it('numbers CSV rows and drops blank ones', async () => {
    const csv = Buffer.from('﻿Ingredient,Amount\r\nWater,500 g\r\n\r\nSalt,5 g\r\n')
    const [sheet] = await spreadsheetToText(csv, 'brine.csv')
    expect(sheet.text).toBe('R1: Ingredient,Amount\nR2: Water,500 g\nR4: Salt,5 g')
  })

  it('explains what to do with old .xls files and other types', async () => {
    await expect(spreadsheetToText(Buffer.from('x'), 'old.xls')).rejects.toThrow(SpreadsheetError)
    await expect(spreadsheetToText(Buffer.from('x'), 'notes.pdf')).rejects.toThrow(/xlsx|CSV/)
    await expect(spreadsheetToText(Buffer.from('not a zip'), 'broken.xlsx')).rejects.toThrow(/couldn’t be opened/)
  })
})
