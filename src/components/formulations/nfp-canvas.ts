// Draws an FDA-standard Nutrition Facts Panel to an HTMLCanvasElement using
// only the Canvas 2D API. No html2canvas — fully deterministic output.

import type { NutrientResult } from '@/lib/formulation-calc'
import type { ExtraNutrient } from './nfp-panel'

const FF = 'Arial, Helvetica, sans-serif'
const W  = 340    // panel CSS width
const PL = 8      // padding-left
const PR = 8      // padding-right
const PT = 5      // padding-top
const PB = 10     // padding-bottom
const IW = W - PL - PR

const DV: Record<string, number> = {
  'Total Fat': 78, 'Saturated Fat': 20, Cholesterol: 300, Sodium: 2300,
  'Total Carbohydrate': 275, 'Dietary Fiber': 28, 'Added Sugars': 50,
  'Vitamin D': 20, Calcium: 1300, Iron: 18, Potassium: 4700,
}

function pct(v: number, key: string): string {
  const dv = DV[key]
  if (dv == null) return ''
  return `${Math.round((v / dv) * 100)}%`
}

function fmt(n: number, d = 1) { return n.toFixed(d) }

function getVal(results: NutrientResult[], name: string, perServing: boolean): number {
  const r = results.find(r => r.name === name)
  if (!r) return 0
  return perServing ? (r.perServing ?? 0) : r.perFinished100g
}

export function drawNfpToCanvas(opts: {
  servingSizeG: number | undefined
  servingsPerContainer: number | undefined
  results: NutrientResult[]
  hideZeros?: boolean
  extraNutrients?: ExtraNutrient[]
  allergenStatement?: string
  ingredientStatement?: string
  scale?: number
}): HTMLCanvasElement {
  const {
    servingSizeG, servingsPerContainer, results,
    hideZeros = false, extraNutrients = [],
    allergenStatement, ingredientStatement,
    scale = 3,
  } = opts

  const perServing = !!servingSizeG
  const show = (v: number) => !hideZeros || v > 0
  const g = (name: string) => getVal(results, name, perServing)
  const visExtras = extraNutrients.filter(n => !hideZeros || n.value > 0)

  const calories    = g('Energy')
  const totalFat    = g('Total Fat')
  const satFat      = g('Saturated Fat')
  const transFat    = g('Trans Fat')
  const polyuFat    = g('Polyunsaturated Fat')
  const monouFat    = g('Monounsaturated Fat')
  const cholesterol = g('Cholesterol')
  const sodium      = g('Sodium')
  const totalCarb   = g('Total Carbohydrate')
  const fiber       = g('Dietary Fiber')
  const totalSugars = g('Total Sugars')
  const addedSugars = g('Added Sugars')
  const protein     = g('Protein')
  const vitaminD    = g('Vitamin D')
  const calcium     = g('Calcium')
  const iron        = g('Iron')
  const potassium   = g('Potassium')

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
  ctx.fillText(
    servingsPerContainer != null
      ? `${Math.round(servingsPerContainer * 10) / 10} servings per container`
      : 'Servings per container variable',
    PL, y,
  )
  y += 12

  // Serving size row
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'left'
  ctx.font = `700 10px ${FF}`
  ctx.fillText('Serving size', PL, y)
  ctx.textAlign = 'right'
  ctx.font = `700 12px ${FF}`
  ctx.fillText(servingSizeG ? `${Math.round(servingSizeG)}g` : '100g', PL + IW, y)
  y += 15

  hline(10, 3, 0)

  // "Amount per serving"
  ctx.font = `400 8px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'right'
  ctx.fillText(perServing ? 'Amount per serving' : 'Amount per 100g', PL + IW, y)
  y += 11

  // Calories
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'left'
  ctx.font = `700 22px ${FF}`
  ctx.fillText('Calories', PL, y)
  ctx.textAlign = 'right'
  ctx.font = `700 34px ${FF}`
  ctx.fillText(String(Math.round(calories)), PL + IW, y)
  y += 38

  hline(7, 3, 2)

  // % Daily Value header
  ctx.font = `700 8px ${FF}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'black'
  ctx.textAlign = 'right'
  ctx.fillText('% Daily Value*', PL + IW, y)
  y += 11

  // Nutrient rows
  if (show(totalFat))    nutRow({ boldL: 'Total Fat',          normL: ` ${fmt(totalFat)}g`,             right: pct(totalFat, 'Total Fat') })
  if (show(satFat))      nutRow({ normL: `Saturated Fat ${fmt(satFat)}g`,                               right: pct(satFat, 'Saturated Fat'),    indent: 16 })
  if (show(transFat)) {
    // "Trans" in italic
    hline(1, 2, 2)
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'left'
    ctx.font = `italic 400 10px ${FF}`
    ctx.fillText('Trans', PL + 16, y)
    const tw = ctx.measureText('Trans').width
    ctx.font = `400 10px ${FF}`
    ctx.fillText(` Fat ${fmt(transFat)}g`, PL + 16 + tw, y)
    y += 13
  }
  if (polyuFat > 0)      nutRow({ normL: `Polyunsaturated Fat ${fmt(polyuFat)}g`,                                                             indent: 16 })
  if (monouFat > 0)      nutRow({ normL: `Monounsaturated Fat ${fmt(monouFat)}g`,                                                             indent: 16 })
  if (show(cholesterol)) nutRow({ boldL: 'Cholesterol',        normL: ` ${Math.round(cholesterol)}mg`, right: pct(cholesterol, 'Cholesterol') })
  if (show(sodium))      nutRow({ boldL: 'Sodium',             normL: ` ${Math.round(sodium)}mg`,      right: pct(sodium, 'Sodium') })
  if (show(totalCarb))   nutRow({ boldL: 'Total Carbohydrate', normL: ` ${fmt(totalCarb)}g`,            right: pct(totalCarb, 'Total Carbohydrate') })
  if (show(fiber))       nutRow({ normL: `Dietary Fiber ${fmt(fiber)}g`,                                right: pct(fiber, 'Dietary Fiber'),     indent: 16 })
  if (show(totalSugars)) nutRow({ normL: `Total Sugars ${fmt(totalSugars)}g`,                                                                 indent: 16 })
  if (show(addedSugars)) nutRow({ normL: `Includes ${fmt(addedSugars)}g Added Sugars`,                  right: pct(addedSugars, 'Added Sugars'), indent: 32 })
  if (show(protein))     nutRow({ boldL: 'Protein',            normL: ` ${fmt(protein)}g` })

  hline(7, 3, 2)

  // Vitamins & minerals
  let firstVit = true
  function doVit(label: string, key: string, v: number) {
    if (!show(v)) return
    vitRow(label, pct(v, key), firstVit)
    firstVit = false
  }
  doVit(`Vitamin D ${fmt(vitaminD)}mcg`, 'Vitamin D', vitaminD)
  doVit(`Calcium ${Math.round(calcium)}mg`,   'Calcium',   calcium)
  doVit(`Iron ${fmt(iron)}mg`,                'Iron',      iron)
  doVit(`Potassium ${Math.round(potassium)}mg`, 'Potassium', potassium)

  // Extra micro / phyto nutrients
  for (const n of visExtras) {
    const valStr = n.unit === 'g' ? `${n.value.toFixed(1)}g`
      : n.value < 10                ? `${n.value.toFixed(1)}${n.unit}`
      : `${Math.round(n.value)}${n.unit}`
    nutRow({ normL: `${n.name} ${valStr}`, right: n.dvPct ?? '' })
  }

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
