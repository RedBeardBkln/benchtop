'use client'

import { forwardRef } from 'react'
import type { NfpModel, NfpRow } from '@/lib/nfp-model'
import { RuleTip } from './rule-tip'

// Pure renderer for an NfpModel (see lib/nfp-model.ts). Every number on the label is already
// FDA-rounded in the model; hovering a value shows the rule that produced it.

export type NfpPanelProps = {
  model: NfpModel
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

function RowLabel({ row }: { row: NfpRow }) {
  const amount = <RuleTip rules={[row.amountRule]}>{row.amount}</RuleTip>
  if (row.layout === 'trans') {
    return <span><em>Trans</em> Fat {amount}</span>
  }
  if (row.layout === 'added') {
    return <span>Includes {amount} Added Sugars</span>
  }
  if (row.labelBold) {
    return <span><strong>{row.label}</strong> {amount}</span>
  }
  return <span>{row.label} {amount}</span>
}

function Row({ row, first }: { row: NfpRow; first: boolean }) {
  const dv = row.dvPct != null
    ? <RuleTip rules={[row.dvRule]}>{row.dvPct}</RuleTip>
    : null
  const bold = row.section === 'main'
  return (
    <>
      {!first && <div style={rule(1, 2)} />}
      <div style={rowStyle(row.indent)}>
        <RowLabel row={row} />
        {dv && (bold ? <strong>{dv}</strong> : <span>{dv}</span>)}
      </div>
    </>
  )
}

export const NfpPanel = forwardRef<HTMLDivElement, NfpPanelProps>(function NfpPanel({ model }, ref) {
  const main = model.rows.filter(r => r.section === 'main')
  const vitamins = model.rows.filter(r => r.section === 'vitamins')
  const extras = model.rows.filter(r => r.section === 'extras')

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
        <RuleTip rules={[model.servingsRule]}>{model.servingsText}</RuleTip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Serving size</span>
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
          <RuleTip rules={[model.servingSizeRule]}>{model.servingSizeText}</RuleTip>
        </span>
      </div>

      {/* Calories — always shown */}
      <div style={rule(10)} />
      <div style={{ fontSize: '8px', textAlign: 'right', marginBottom: '-1px' }}>{model.basisLabel}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '22px', fontWeight: 'bold' }}>Calories</span>
        <span style={{ fontSize: '34px', fontWeight: 'bold', lineHeight: 1 }}>
          <RuleTip rules={[model.caloriesRule]}>{model.calories}</RuleTip>
        </span>
      </div>

      <div style={rule(7)} />

      {/* %DV header */}
      <div style={{ textAlign: 'right', fontSize: '8px', fontWeight: 'bold', marginBottom: '1px' }}>
        % Daily Value*
      </div>

      {main.map(row => (
        <div key={row.key}><Row row={row} first={false} /></div>
      ))}

      {/* Thick rule before vitamins */}
      <div style={rule(7)} />

      {vitamins.map((row, i) => (
        <div key={row.key}><Row row={row} first={i === 0} /></div>
      ))}

      {/* Extra micro / phyto nutrients */}
      {extras.map(row => (
        <div key={row.key}><Row row={row} first={false} /></div>
      ))}

      {/* Footnote */}
      <div style={rule(3, 3)} />
      <div style={{ fontSize: '7px', lineHeight: 1.3 }}>
        * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes
        to a daily diet. 2,000 calories a day is used for general nutrition advice.
      </div>

      {/* Allergen Statement */}
      {model.allergenStatement && (
        <>
          <div style={rule(1, 4)} />
          <div style={{ fontSize: '9px', lineHeight: 1.4 }}>
            <strong>Contains:</strong> {model.allergenStatement}
          </div>
        </>
      )}

      {/* Ingredient Statement */}
      {model.ingredientStatement && (
        <>
          <div style={rule(1, 4)} />
          <div style={{ fontSize: '8px', lineHeight: 1.5 }}>
            <strong>INGREDIENTS:</strong> {model.ingredientStatement}
          </div>
        </>
      )}
    </div>
  )
})
