// Draws an FDA Nutrition Facts Panel (standard, tabular or linear format) to an HTMLCanvasElement
// using only the Canvas 2D API. No html2canvas — fully deterministic output.

import { abbreviate, allergenBody, splitTabularRows, type NfpModel, type NfpRow } from '@/lib/nfp-model'

const FF = 'Arial, Helvetica, sans-serif'
const PL = 8      // padding-left
const PR = 8      // padding-right
const PT = 5      // padding-top
const PB = 10     // padding-bottom
const FOOTNOTE =
  '* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. ' +
  '2,000 calories a day is used for general nutrition advice.'

const WIDTH = { standard: 340, tabular: 600, linear: 460 } as const

type Ctx = CanvasRenderingContext2D

/** A piece of styled text in a run-in paragraph. */
type Run = { text: string; size: number; weight?: number; italic?: boolean }

function setFont(ctx: Ctx, size: number, weight: number | string = 400, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
}

function bar(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'black'
  ctx.fillRect(x, y, w, h)
}

function text(ctx: Ctx, s: string, x: number, y: number, align: CanvasTextAlign = 'left') {
  ctx.textAlign = align
  ctx.fillText(s, x, y)
}

/** Word-wraps styled runs into the box starting at (x, y), width w. Returns the y below the last line. */
function drawRuns(ctx: Ctx, runs: Run[], x: number, y: number, w: number, lineH: number): number {
  const tokens = runs.flatMap(r => r.text.split(/(\s+)/).filter(Boolean).map(t => ({ ...r, text: t })))
  let cx = x
  let lineUsed = false
  for (const t of tokens) {
    setFont(ctx, t.size, t.weight ?? 400, t.italic)
    const isSpace = /^\s+$/.test(t.text)
    if (isSpace && !lineUsed) continue
    const tw = ctx.measureText(t.text).width
    if (!isSpace && lineUsed && cx + tw > x + w) {
      y += lineH
      cx = x
    }
    if (isSpace && cx + tw > x + w) continue
    text(ctx, t.text, cx, y)
    cx += tw
    lineUsed = cx > x
  }
  return y + lineH
}

/** Label runs for a nutrient row; `short` uses FDA-permitted abbreviations. */
function labelRuns(row: NfpRow, size: number, short: boolean): Run[] {
  if (row.layout === 'trans') return [{ text: 'Trans', size, italic: true }, { text: ` Fat ${row.amount}`, size }]
  if (row.layout === 'added') return [{ text: `${short ? 'Incl.' : 'Includes'} ${row.amount} Added Sugars`, size }]
  const label = short ? abbreviate(row.label) : row.label
  if (row.labelBold) return [{ text: label, size, weight: 700 }, { text: ` ${row.amount}`, size }]
  return [{ text: `${label} ${row.amount}`, size }]
}

/** One nutrient row in a column: thin rule above, label on the left, %DV on the right. */
function columnRow(ctx: Ctx, row: NfpRow, x: number, w: number, y: number, opts: { rule: boolean; short: boolean }): number {
  if (opts.rule) { bar(ctx, x, y + 2, w, 1); y += 5 }
  let cx = x + row.indent
  for (const r of labelRuns(row, 10, opts.short)) {
    setFont(ctx, r.size, r.weight ?? 400, r.italic)
    text(ctx, r.text, cx, y)
    cx += ctx.measureText(r.text).width
  }
  if (row.dvPct != null) {
    setFont(ctx, 10, row.section === 'main' ? 700 : 400)
    text(ctx, row.dvPct, x + w, y, 'right')
  }
  return y + 13
}

function drawFootnote(ctx: Ctx, x: number, w: number, y: number): number {
  bar(ctx, x, y + 3, w, 3)
  return drawRuns(ctx, [{ text: FOOTNOTE, size: 7 }], x, y + 9, w, 9)
}

function drawStatements(ctx: Ctx, model: NfpModel, x: number, w: number, y: number): number {
  const allergens = model.allergenStatement ? allergenBody(model.allergenStatement) : ''
  if (allergens) {
    bar(ctx, x, y + 5, w, 1)
    y = drawRuns(ctx, [{ text: 'Contains:', size: 9, weight: 700 }, { text: ` ${allergens}`, size: 9 }], x, y + 10, w, 12)
  }
  if (model.ingredientStatement) {
    bar(ctx, x, y + 5, w, 1)
    y = drawRuns(
      ctx,
      [{ text: 'INGREDIENTS:', size: 8, weight: 700 }, { text: ` ${model.ingredientStatement}`, size: 8 }],
      x, y + 10, w, 10,
    )
  }
  return y
}

// ─── Standard (vertical) ─────────────────────────────────────────────────────

function drawStandard(ctx: Ctx, model: NfpModel): number {
  const IW = WIDTH.standard - PL - PR
  let y = PT

  setFont(ctx, 38, 900)
  text(ctx, 'Nutrition Facts', PL, y)
  y += 40

  bar(ctx, PL, y + 1, IW, 3)
  y += 6

  setFont(ctx, 9)
  text(ctx, model.servingsText, PL, y)
  y += 12

  setFont(ctx, 10, 700)
  text(ctx, 'Serving size', PL, y)
  setFont(ctx, 12, 700)
  text(ctx, model.servingSizeText, PL + IW, y, 'right')
  y += 15

  bar(ctx, PL, y + 3, IW, 10)
  y += 13

  setFont(ctx, 8)
  text(ctx, model.basisLabel, PL + IW, y, 'right')
  y += 11

  setFont(ctx, 22, 700)
  text(ctx, 'Calories', PL, y)
  setFont(ctx, 34, 700)
  text(ctx, model.calories, PL + IW, y, 'right')
  y += 38

  bar(ctx, PL, y + 3, IW, 7)
  y += 12

  setFont(ctx, 8, 700)
  text(ctx, '% Daily Value*', PL + IW, y, 'right')
  y += 11

  for (const row of model.rows.filter(r => r.section === 'main')) {
    y = columnRow(ctx, row, PL, IW, y, { rule: true, short: false })
  }

  bar(ctx, PL, y + 3, IW, 7)
  y += 12

  model.rows.filter(r => r.section === 'vitamins').forEach((row, i) => {
    y = columnRow(ctx, row, PL, IW, y, { rule: i > 0, short: false })
  })
  for (const row of model.rows.filter(r => r.section === 'extras')) {
    y = columnRow(ctx, row, PL, IW, y, { rule: true, short: false })
  }

  y = drawFootnote(ctx, PL, IW, y)
  return drawStatements(ctx, model, PL, IW, y)
}

// ─── Tabular ─────────────────────────────────────────────────────────────────

function drawTabular(ctx: Ctx, model: NfpModel): number {
  const IW = WIDTH.tabular - PL - PR
  const HEAD_W = 145
  const DIVIDER = 6
  const colsX = PL + HEAD_W + DIVIDER + 8
  const colW = (PL + IW - colsX - 11) / 2
  const col2X = colsX + colW + 11
  const top = PT + 1

  // Header column: title, servings, calories
  let hy = top
  setFont(ctx, 28, 900)
  text(ctx, 'Nutrition', PL, hy)
  text(ctx, 'Facts', PL, hy + 28)
  hy += 58
  bar(ctx, PL, hy, HEAD_W, 1)
  hy = drawRuns(ctx, [{ text: model.servingsText, size: 9 }], PL, hy + 4, HEAD_W, 11)
  hy = drawRuns(
    ctx,
    [{ text: 'Serving size', size: 10, weight: 700 }, { text: ` ${model.servingSizeText}`, size: 10, weight: 700 }],
    PL, hy + 1, HEAD_W, 12,
  )
  bar(ctx, PL, hy + 3, HEAD_W, 7)
  hy += 14
  setFont(ctx, 18, 700)
  text(ctx, 'Calories', PL, hy)
  hy += 19
  setFont(ctx, 8)
  text(ctx, model.basisLabel.replace(/^Amount /, ''), PL, hy)
  hy += 10
  setFont(ctx, 30, 700)
  text(ctx, model.calories, PL, hy)
  hy += 32

  // Two nutrient columns
  const [left, right] = splitTabularRows(model.rows.filter(r => r.section === 'main'))
  const drawColumn = (rows: NfpRow[], x: number) => {
    let cy = top
    setFont(ctx, 8, 700)
    text(ctx, model.basisLabel, x, cy)
    text(ctx, '% Daily Value*', x + colW, cy, 'right')
    cy += 10
    for (const row of rows) cy = columnRow(ctx, row, x, colW, cy, { rule: true, short: true })
    return cy
  }
  const bottom = Math.max(hy, drawColumn(left, colsX), drawColumn(right, col2X))

  bar(ctx, PL + HEAD_W + 2, top, DIVIDER, bottom - top)
  bar(ctx, colsX + colW + 5, top, 1, bottom - top)

  let y = bottom
  const micros = model.rows.filter(r => r.section !== 'main')
  if (micros.length > 0) {
    bar(ctx, PL, y + 3, IW, 7)
    const runs: Run[] = micros.map((row, i) => ({
      text: `${i > 0 ? '  •  ' : ''}${abbreviate(row.label)} ${row.amount}${row.dvPct != null ? ` ${row.dvPct}` : ''}`,
      size: 10,
    }))
    y = drawRuns(ctx, runs, PL, y + 14, IW, 14)
  }

  y = drawFootnote(ctx, PL, IW, y)
  return drawStatements(ctx, model, PL, IW, y)
}

// ─── Linear ──────────────────────────────────────────────────────────────────

function drawLinear(ctx: Ctx, model: NfpModel): number {
  const IW = WIDTH.linear - PL - PR
  const runs: Run[] = [
    { text: 'Nutrition Facts', size: 13, weight: 900 },
    { text: ` ${model.servingsText}, `, size: 10 },
    { text: 'Serv. size', size: 10, weight: 700 },
    { text: ` ${model.servingSizeText}, `, size: 10 },
    { text: `${model.basisLabel}: Calories`, size: 10, weight: 700 },
    { text: ` ${model.calories}`, size: 10 },
  ]
  for (const row of model.rows) {
    runs.push({ text: ', ', size: 10 }, ...labelRuns(row, 10, true))
    if (row.dvPct != null) runs.push({ text: ` (${row.dvPct} DV)`, size: 10 })
  }
  runs.push({ text: '.', size: 10 })

  const y = drawRuns(ctx, runs, PL, PT + 2, IW, 14)
  return drawStatements(ctx, model, PL, IW, y)
}

export function drawNfpToCanvas(opts: { model: NfpModel; scale?: number }): HTMLCanvasElement {
  const { model, scale = 3 } = opts
  const layout = model.layout ?? 'standard'
  const W = WIDTH[layout]

  // Draw into an oversized canvas, then crop to actual content height
  const MAX_H = 3000
  const scratch = document.createElement('canvas')
  scratch.width  = W * scale
  scratch.height = MAX_H * scale
  const ctx = scratch.getContext('2d')!
  ctx.scale(scale, scale)

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, W, MAX_H)

  const y = layout === 'tabular' ? drawTabular(ctx, model)
    : layout === 'linear' ? drawLinear(ctx, model)
    : drawStandard(ctx, model)

  // Crop scratch canvas to actual content height and add border
  const finalH = Math.ceil(y + PB)
  const out = document.createElement('canvas')
  out.width  = W * scale
  out.height = finalH * scale
  const octx = out.getContext('2d')!

  octx.fillStyle = 'white'
  octx.fillRect(0, 0, W * scale, finalH * scale)
  octx.drawImage(scratch, 0, 0)

  // 2px border
  octx.strokeStyle = 'black'
  octx.lineWidth = 2 * scale
  octx.strokeRect(scale, scale, W * scale - 2 * scale, finalH * scale - 2 * scale)

  return out
}
