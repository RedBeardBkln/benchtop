// Draws an FDA-standard Nutrition Facts Panel to an HTMLCanvasElement using
// only the Canvas 2D API. No html2canvas — fully deterministic output.

import type { NfpModel, NfpRow } from '@/lib/nfp-model'

const FF = 'Arial, Helvetica, sans-serif'
const W  = 340    // panel CSS width
const PL = 8      // padding-left
const PR = 8      // padding-right
const PT = 5      // padding-top
const PB = 10     // padding-bottom
const IW = W - PL - PR

export function drawNfpToCanvas(opts: { model: NfpModel; scale?: number }): HTMLCanvasElement {
  const { model, scale = 3 } = opts
  const { allergenStatement, ingredientStatement } = model

  // Draw into an oversized canvas, then crop to actual content height
  const MAX_H = 2000
  const scratch = document.createElement('canvas')
  scratch.width  = W * scale
  scratch.height = MAX_H * scale
  const ctx = scratch.getContext('2d')!
  ctx.scale(scale, scale)

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, W, MAX_H)

  let y = PT

  // ─── helpers ──────────────────────────────────────────────────────────────

  function hline(h: number, mt = 0, mb = 0) {
    y += mt
    ctx.fillStyle = 'black'
    ctx.fillRect(PL, y, IW, h)
    y += h + mb
  }

  // Measure and word-wrap text to fit maxW. Returns array of lines.
  function wrap(text: string, size: number, weight: string | number): string[] {
    ctx.font = `${weight} ${size}px ${FF}`
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (line && ctx.measureText(test).width > IW) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // Draw a nutrient row (thin rule above + left + right text)
  function nutRow({
    boldL = '', normL = '', right = '', indent = 0,
  }: { boldL?: string; normL?: string; right?: string; indent?: number }) {
    hline(1, 2, 2)
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'black'
    let xL = PL + indent
    if (boldL) {
      ctx.font = `700 10px ${FF}`
      ctx.textAlign = 'left'
      ctx.fillText(boldL, xL, y)
      xL += ctx.measureText(boldL).width
    }
    if (normL) {
      ctx.font = `400 10px ${FF}`
      ctx.textAlign = 'left'
      ctx.fillText(normL, xL, y)
    }
    if (right) {
      ctx.font = `700 10px ${FF}`
      ctx.textAlign = 'right'
      ctx.fillText(right, PL + IW, y)
    }
    y += 13
  }

  // Draw a vitamin/mineral row (optional thin rule, then left + right regular weight)
  function vitRow(label: string, pctStr: string, isFirst: boolean) {
    if (!isFirst) hline(1, 2, 2)
    ctx.font = `400 10px ${FF}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'left'
    ctx.fillText(label, PL, y)
    ctx.textAlign = 'right'
    ctx.fillText(pctStr, PL + IW, y)
    y += 13
  }

  // ─── draw ─────────────────────────────────────────────────────────────────

  // Title
  ctx.font = `900 38px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'left'
  ctx.fillText('Nutrition Facts', PL, y)
  y += 40

  hline(3, 1, 2)

  // Servings per container
  ctx.font = `400 9px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'left'
  ctx.fillText(model.servingsText, PL, y)
  y += 12

  // Serving size row
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'left'
  ctx.font = `700 10px ${FF}`
  ctx.fillText('Serving size', PL, y)
  ctx.textAlign = 'right'
  ctx.font = `700 12px ${FF}`
  ctx.fillText(model.servingSizeText, PL + IW, y)
  y += 15

  hline(10, 3, 0)

  // "Amount per serving"
  ctx.font = `400 8px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'right'
  ctx.fillText(model.basisLabel, PL + IW, y)
  y += 11

  // Calories
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'left'
  ctx.font = `700 22px ${FF}`
  ctx.fillText('Calories', PL, y)
  ctx.textAlign = 'right'
  ctx.font = `700 34px ${FF}`
  ctx.fillText(model.calories, PL + IW, y)
  y += 38

  hline(7, 3, 2)

  // % Daily Value header
  ctx.font = `700 8px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'right'
  ctx.fillText('% Daily Value*', PL + IW, y)
  y += 11

  const drawRow = (row: NfpRow, first: boolean) => {
    const right = row.dvPct ?? ''
    if (row.layout === 'trans') {
      hline(1, 2, 2)
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'black'
      ctx.textAlign = 'left'
      ctx.font = `italic 400 10px ${FF}`
      ctx.fillText('Trans', PL + row.indent, y)
      const tw = ctx.measureText('Trans').width
      ctx.font = `400 10px ${FF}`
      ctx.fillText(` Fat ${row.amount}`, PL + row.indent + tw, y)
      y += 13
    } else if (row.layout === 'added') {
      nutRow({ normL: `Includes ${row.amount} Added Sugars`, right, indent: row.indent })
    } else if (row.section === 'main') {
      if (row.labelBold) nutRow({ boldL: row.label, normL: ` ${row.amount}`, right, indent: row.indent })
      else nutRow({ normL: `${row.label} ${row.amount}`, right, indent: row.indent })
    } else {
      vitRow(`${row.label} ${row.amount}`, right, first)
    }
  }

  const main = model.rows.filter(r => r.section === 'main')
  const vitamins = model.rows.filter(r => r.section === 'vitamins')
  const extras = model.rows.filter(r => r.section === 'extras')

  for (const row of main) drawRow(row, false)

  hline(7, 3, 2)

  vitamins.forEach((row, i) => drawRow(row, i === 0))

  // Extra micro / phyto nutrients (plain rows with a rule above each)
  for (const row of extras) nutRow({ normL: `${row.label} ${row.amount}`, right: row.dvPct ?? '' })

  // Footnote
  hline(3, 3, 3)
  {
    const note = '* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.'
    const lines = wrap(note, 7, 400)
    ctx.font = `400 7px ${FF}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'left'
    for (const line of lines) {
      ctx.fillText(line, PL, y)
      y += 9
    }
  }

  // Allergen statement
  if (allergenStatement) {
    hline(1, 5, 4)
    const lines = wrap(`Contains: ${allergenStatement}`, 9, 400)
    ctx.font = `400 9px ${FF}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'left'
    for (const line of lines) {
      ctx.fillText(line, PL, y)
      y += 12
    }
  }

  // Ingredient statement
  if (ingredientStatement) {
    hline(1, 5, 4)
    const fullText = `INGREDIENTS: ${ingredientStatement}`
    const lines = wrap(fullText, 8, 400)
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'left'
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].startsWith('INGREDIENTS:')) {
        ctx.font = `700 8px ${FF}`
        ctx.fillText('INGREDIENTS:', PL, y)
        const bw = ctx.measureText('INGREDIENTS:').width
        ctx.font = `400 8px ${FF}`
        ctx.fillText(lines[i].slice('INGREDIENTS:'.length), PL + bw, y)
      } else {
        ctx.font = `400 8px ${FF}`
        ctx.fillText(lines[i], PL, y)
      }
      y += 10
    }
  }

  y += PB

  // Crop scratch canvas to actual content height and add border
  const finalH = Math.ceil(y)
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
