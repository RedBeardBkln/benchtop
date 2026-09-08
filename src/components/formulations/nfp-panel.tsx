'use client'

import { forwardRef } from 'react'
import type { NutrientResult } from '@/lib/formulation-calc'

// Daily Values are pulled from `nutrients.dailyValueAmount` (via
// NutrientResult.dailyValueAmount) so they live in the DB and update via
// seed migration, not a code release. The lookup-by-name helpers below
// (get, value, dv) are the single source of truth for both value and DV.

export type ExtraNutrient = {
  name: string
  value: number
  unit: string
  dvPct?: string
}

function get(results: NutrientResult[], name: string, usePerServing: boolean): NutrientResult | undefined {
  return results.find(r => r.name === name)
}

function value(r: NutrientResult | undefined, usePerServing: boolean): number {
  if (!r) return 0
  return usePerServing ? (r.perServing ?? 0) : r.perFinished100g
}

function dv(r: NutrientResult | undefined): number | null {
  return r?.dailyValueAmount ?? null
}

function dvPct(value: number, dv: number | null | undefined): string {
  if (dv == null || dv <= 0) return ''
  return `${Math.round((value / dv) * 100)}%`
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals)
}

function fmtExtra(value: number, unit: string): string {
  if (unit === 'g') return value.toFixed(1)
  if (value === 0) return '0'
  if (value < 0.1) return value.toFixed(2)
  if (value < 10) return value.toFixed(1)
  return Math.round(value).toString()
}

export type NfpPanelProps = {
  servingSizeG: number | undefined
  servingsPerContainer: number | undefined
  results: NutrientResult[]
  hideZeros?: boolean
  extraNutrients?: ExtraNutrient[]
  allergenStatement?: string
  ingredientStatement?: string
}

const rule = (height: number, marginPx = 3): React.CSSProperties => ({
  borderTop: `${height}px solid black`,
  marginTop: `${marginPx}px`,
  marginBottom: `${marginPx}px`,
})

const rowStyle = (indent = 0): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: '10px',
  lineHeight: '13px',
  paddingLeft: `${indent}px`,
})

export const NfpPanel = forwardRef<HTMLDivElement, NfpPanelProps>(function NfpPanel(
  { servingSizeG, servingsPerContainer, results, hideZeros = false, extraNutrients, allergenStatement, ingredientStatement },
  ref,
) {
  const usePerServing = !!servingSizeG

  const show = (v: number) => !hideZeros || v > 0

  const totalFat    = value(get(results, 'Total Fat', usePerServing), usePerServing)
  const satFat      = value(get(results, 'Saturated Fat', usePerServing), usePerServing)
  const transFat    = value(get(results, 'Trans Fat', usePerServing), usePerServing)
  const polyuFat    = value(get(results, 'Polyunsaturated Fat', usePerServing), usePerServing)
  const monouFat    = value(get(results, 'Monounsaturated Fat', usePerServing), usePerServing)
  const cholesterol = value(get(results, 'Cholesterol', usePerServing), usePerServing)
  const sodium      = value(get(results, 'Sodium', usePerServing), usePerServing)
  const totalCarb   = value(get(results, 'Total Carbohydrate', usePerServing), usePerServing)
  const fiber       = value(get(results, 'Dietary Fiber', usePerServing), usePerServing)
  const totalSugars = value(get(results, 'Total Sugars', usePerServing), usePerServing)
  const addedSugars = value(get(results, 'Added Sugars', usePerServing), usePerServing)
  const protein     = value(get(results, 'Protein', usePerServing), usePerServing)
  const vitaminD    = value(get(results, 'Vitamin D', usePerServing), usePerServing)
  const calcium     = value(get(results, 'Calcium', usePerServing), usePerServing)
  const iron        = value(get(results, 'Iron', usePerServing), usePerServing)
  const potassium   = value(get(results, 'Potassium', usePerServing), usePerServing)

  // Pull DVs straight from the results array (DB-sourced)
  const totalFatDv    = dv(get(results, 'Total Fat', usePerServing))
  const satFatDv      = dv(get(results, 'Saturated Fat', usePerServing))
  const cholDv        = dv(get(results, 'Cholesterol', usePerServing))
  const sodiumDv      = dv(get(results, 'Sodium', usePerServing))
  const totalCarbDv   = dv(get(results, 'Total Carbohydrate', usePerServing))
  const fiberDv       = dv(get(results, 'Dietary Fiber', usePerServing))
  const addedSugarsDv = dv(get(results, 'Added Sugars', usePerServing))
  const vitaminDDv    = dv(get(results, 'Vitamin D', usePerServing))
  const calciumDv     = dv(get(results, 'Calcium', usePerServing))
  const ironDv        = dv(get(results, 'Iron', usePerServing))
  const potassiumDv   = dv(get(results, 'Potassium', usePerServing))

  const calories    = value(get(results, 'Energy', usePerServing), usePerServing)

  const basisLabel = usePerServing ? 'Amount per serving' : 'Amount per 100g'

  const visibleExtras = (extraNutrients ?? []).filter(n => !hideZeros || n.value > 0)

  return (
    <div
      ref={ref}
      style={{
        display: 'block',
        width: '340px',
        maxWidth: '100%',
        border: '2px solid black',
        padding: '5px 8px 8px',
        fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        backgroundColor: 'white',
        color: 'black',
        boxSizing: 'border-box',
        overflow: 'visible',
        lineHeight: 'normal',
      }}
    >
      {/* Title */}
      <div style={{ fontSize: '38px', fontWeight: 900, lineHeight: 1, marginBottom: '1px' }}>
        Nutrition Facts
      </div>

      <div style={rule(3)} />

      {/* Servings */}
      <div style={{ fontSize: '9px', margin: '1px 0' }}>
        {servingsPerContainer != null
          ? `${Math.round(servingsPerContainer * 10) / 10} servings per container`
          : 'Servings per container variable'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Serving size</span>
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
          {servingSizeG ? `${Math.round(servingSizeG)}g` : '100g'}
        </span>
      </div>

      {/* Calories — always shown */}
      <div style={rule(10)} />
      <div style={{ fontSize: '8px', textAlign: 'right', marginBottom: '-1px' }}>{basisLabel}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '22px', fontWeight: 'bold' }}>Calories</span>
        <span style={{ fontSize: '34px', fontWeight: 'bold', lineHeight: 1 }}>{Math.round(calories)}</span>
      </div>

      <div style={rule(7)} />

      {/* %DV header */}
      <div style={{ textAlign: 'right', fontSize: '8px', fontWeight: 'bold', marginBottom: '1px' }}>
        % Daily Value*
      </div>

      {/* Total Fat */}
      {show(totalFat) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle()}>
            <span><strong>Total Fat</strong> {fmt(totalFat)}g</span>
            <strong>{dvPct(totalFat, totalFatDv)}</strong>
          </div>
        </>
      )}

      {/* Saturated Fat */}
      {show(satFat) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle(16)}>
            <span>Saturated Fat {fmt(satFat)}g</span>
            <strong>{dvPct(satFat, satFatDv)}</strong>
          </div>
        </>
      )}

      {/* Trans Fat */}
      {show(transFat) && (
        <>
          <div style={rule(1, 2)} />
          <div style={{ fontSize: '10px', lineHeight: '13px', paddingLeft: '16px' }}>
            <em>Trans</em> Fat {fmt(transFat)}g
          </div>
        </>
      )}

      {/* Polyunsaturated Fat (voluntary) */}
      {polyuFat > 0 && (
        <>
          <div style={rule(1, 2)} />
          <div style={{ fontSize: '10px', lineHeight: '13px', paddingLeft: '16px' }}>
            Polyunsaturated Fat {fmt(polyuFat)}g
          </div>
        </>
      )}

      {/* Monounsaturated Fat (voluntary) */}
      {monouFat > 0 && (
        <>
          <div style={rule(1, 2)} />
          <div style={{ fontSize: '10px', lineHeight: '13px', paddingLeft: '16px' }}>
            Monounsaturated Fat {fmt(monouFat)}g
          </div>
        </>
      )}

      {/* Cholesterol */}
      {show(cholesterol) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle()}>
            <span><strong>Cholesterol</strong> {Math.round(cholesterol)}mg</span>
            <strong>{dvPct(cholesterol, cholDv)}</strong>
          </div>
        </>
      )}

      {/* Sodium */}
      {show(sodium) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle()}>
            <span><strong>Sodium</strong> {Math.round(sodium)}mg</span>
            <strong>{dvPct(sodium, sodiumDv)}</strong>
          </div>
        </>
      )}

      {/* Total Carbohydrate */}
      {show(totalCarb) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle()}>
            <span><strong>Total Carbohydrate</strong> {fmt(totalCarb)}g</span>
            <strong>{dvPct(totalCarb, totalCarbDv)}</strong>
          </div>
        </>
      )}

      {/* Dietary Fiber */}
      {show(fiber) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle(16)}>
            <span>Dietary Fiber {fmt(fiber)}g</span>
            <strong>{dvPct(fiber, fiberDv)}</strong>
          </div>
        </>
      )}

      {/* Total Sugars */}
      {show(totalSugars) && (
        <>
          <div style={rule(1, 2)} />
          <div style={{ fontSize: '10px', lineHeight: '13px', paddingLeft: '16px' }}>
            Total Sugars {fmt(totalSugars)}g
          </div>
        </>
      )}

      {/* Added Sugars */}
      {show(addedSugars) && (
        <>
          <div style={rule(1, 2)} />
          <div style={rowStyle(32)}>
            <span>Includes {fmt(addedSugars)}g Added Sugars</span>
            <strong>{dvPct(addedSugars, addedSugarsDv)}</strong>
          </div>
        </>
      )}

      {/* Protein */}
      {show(protein) && (
        <>
          <div style={rule(1, 2)} />
          <div style={{ fontSize: '10px', lineHeight: '13px' }}>
            <strong>Protein</strong> {fmt(protein)}g
          </div>
        </>
      )}

      {/* Thick rule before vitamins */}
      <div style={rule(7)} />

      {/* Mandatory vitamins & minerals */}
      {show(vitaminD) && (
        <div style={rowStyle()}>
          <span>Vitamin D {fmt(vitaminD)}mcg</span>
          <span>{dvPct(vitaminD, vitaminDDv)}</span>
        </div>
      )}
      {show(calcium) && (
        <>
          {show(vitaminD) && <div style={rule(1, 2)} />}
          <div style={rowStyle()}>
            <span>Calcium {Math.round(calcium)}mg</span>
            <span>{dvPct(calcium, calciumDv)}</span>
          </div>
        </>
      )}
      {show(iron) && (
        <>
          {(show(vitaminD) || show(calcium)) && <div style={rule(1, 2)} />}
          <div style={rowStyle()}>
            <span>Iron {fmt(iron)}mg</span>
            <span>{dvPct(iron, ironDv)}</span>
          </div>
        </>
      )}
      {show(potassium) && (
        <>
          {(show(vitaminD) || show(calcium) || show(iron)) && <div style={rule(1, 2)} />}
          <div style={rowStyle()}>
            <span>Potassium {Math.round(potassium)}mg</span>
            <span>{dvPct(potassium, potassiumDv)}</span>
          </div>
        </>
      )}

      {/* Extra micro / phyto nutrients */}
      {visibleExtras.map(n => (
        <div key={n.name}>
          <div style={rule(1, 2)} />
          <div style={rowStyle()}>
            <span>
              {n.name} {fmtExtra(n.value, n.unit)}{n.unit}
            </span>
            {n.dvPct && <span>{n.dvPct}</span>}
          </div>
        </div>
      ))}

      {/* Footnote */}
      <div style={rule(3, 3)} />
      <div style={{ fontSize: '7px', lineHeight: 1.3 }}>
        * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes
        to a daily diet. 2,000 calories a day is used for general nutrition advice.
      </div>

      {/* Allergen Statement */}
      {allergenStatement && (
        <>
          <div style={rule(1, 4)} />
          <div style={{ fontSize: '9px', lineHeight: 1.4 }}>
            <strong>Contains:</strong> {allergenStatement}
          </div>
        </>
      )}

      {/* Ingredient Statement */}
      {ingredientStatement && (
        <>
          <div style={rule(1, 4)} />
          <div style={{ fontSize: '8px', lineHeight: 1.5 }}>
            <strong>INGREDIENTS:</strong> {ingredientStatement}
          </div>
        </>
      )}
    </div>
  )
})
