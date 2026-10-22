'use client'

import { forwardRef } from 'react'
import { abbreviate, allergenBody, splitTabularRows, type NfpModel, type NfpRow } from '@/lib/nfp-model'
import { RuleTip } from './rule-tip'

// Pure renderer for an NfpModel (see lib/nfp-model.ts). Every number on the label is already
// FDA-rounded in the model; hovering a value shows the rule that produced it. The model's layout
// picks the FDA format: standard (vertical), tabular or linear.

export type NfpPanelProps = {
  model: NfpModel
}

const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'
const FOOTNOTE =
  '* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes ' +
  'to a daily diet. 2,000 calories a day is used for general nutrition advice.'

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

const frame = (width: number, padding: string): React.CSSProperties => ({
  display: 'block',
  width: `${width}px`,
  maxWidth: '100%',
  border: '2px solid black',
  padding,
  fontFamily: FONT,
  backgroundColor: 'white',
  color: 'black',
  boxSizing: 'border-box',
  overflow: 'visible',
  lineHeight: 'normal',
})

function RowLabel({ row, short = false }: { row: NfpRow; short?: boolean }) {
  const amount = <RuleTip rules={[row.amountRule]}>{row.amount}</RuleTip>
  if (row.layout === 'trans') {
    return <span><em>Trans</em> Fat {amount}</span>
  }
  if (row.layout === 'added') {
    return <span>{short ? 'Incl.' : 'Includes'} {amount} Added Sugars</span>
  }
  const label = short ? abbreviate(row.label) : row.label
  if (row.labelBold) {
    return <span><strong>{label}</strong> {amount}</span>
  }
  return <span>{label} {amount}</span>
}

function Row({ row, first, short }: { row: NfpRow; first: boolean; short?: boolean }) {
  const dv = row.dvPct != null
    ? <RuleTip rules={[row.dvRule]}>{row.dvPct}</RuleTip>
    : null
  const bold = row.section === 'main'
  return (
    <>
      {!first && <div style={rule(1, 2)} />}
      <div style={rowStyle(row.indent)}>
        <RowLabel row={row} short={short} />
        {dv && (bold ? <strong>{dv}</strong> : <span>{dv}</span>)}
      </div>
    </>
  )
}

/** Allergen and ingredient statements, printed under the panel in every layout. */
function Statements({ model }: { model: NfpModel }) {
  const allergens = model.allergenStatement ? allergenBody(model.allergenStatement) : ''
  return (
    <>
      {allergens && (
        <>
          <div style={rule(1, 4)} />
          <div style={{ fontSize: '9px', lineHeight: 1.4 }}>
            <strong>Contains:</strong> {allergens}
          </div>
        </>
      )}
      {model.ingredientStatement && (
        <>
          <div style={rule(1, 4)} />
          <div style={{ fontSize: '8px', lineHeight: 1.5 }}>
            <strong>INGREDIENTS:</strong> {model.ingredientStatement}
          </div>
        </>
      )}
    </>
  )
}

function StandardPanel({ model }: { model: NfpModel }) {
  const main = model.rows.filter(r => r.section === 'main')
  const vitamins = model.rows.filter(r => r.section === 'vitamins')
  const extras = model.rows.filter(r => r.section === 'extras')

  return (
    <>
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
      <div style={{ fontSize: '7px', lineHeight: 1.3 }}>{FOOTNOTE}</div>

      <Statements model={model} />
    </>
  )
}

function TabularColumn({ rows, basisLabel }: { rows: NfpRow[]; basisLabel: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold' }}>
        <span>{basisLabel}</span>
        <span>% Daily Value*</span>
      </div>
      {rows.map(row => (
        <div key={row.key}><Row row={row} first={false} short /></div>
      ))}
    </div>
  )
}

function MicronutrientRun({ rows }: { rows: NfpRow[] }) {
  return (
    <div style={{ fontSize: '10px', lineHeight: '14px' }}>
      {rows.map((row, i) => (
        <span key={row.key} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 && <span style={{ padding: '0 5px' }}>•</span>}
          {abbreviate(row.label)} <RuleTip rules={[row.amountRule]}>{row.amount}</RuleTip>
          {row.dvPct != null && <> <RuleTip rules={[row.dvRule]}>{row.dvPct}</RuleTip></>}
        </span>
      ))}
    </div>
  )
}

function TabularPanel({ model }: { model: NfpModel }) {
  const [left, right] = splitTabularRows(model.rows.filter(r => r.section === 'main'))
  const micros = model.rows.filter(r => r.section !== 'main')

  return (
    <>
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* Header column */}
        <div style={{ width: '150px', flexShrink: 0, borderRight: '7px solid black', paddingRight: '8px' }}>
          <div style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1 }}>Nutrition Facts</div>
          <div style={rule(1, 3)} />
          <div style={{ fontSize: '9px' }}>
            <RuleTip rules={[model.servingsRule]}>{model.servingsText}</RuleTip>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
            Serving size{' '}
            <RuleTip rules={[model.servingSizeRule]}>{model.servingSizeText}</RuleTip>
          </div>
          <div style={rule(7, 4)} />
          <div style={{ fontSize: '18px', fontWeight: 'bold', lineHeight: 1 }}>Calories</div>
          <div style={{ fontSize: '8px' }}>{model.basisLabel.replace(/^Amount /, '')}</div>
          <div style={{ fontSize: '30px', fontWeight: 'bold', lineHeight: 1, marginTop: '2px' }}>
            <RuleTip rules={[model.caloriesRule]}>{model.calories}</RuleTip>
          </div>
        </div>

        <TabularColumn rows={left} basisLabel={model.basisLabel} />
        <div style={{ borderLeft: '1px solid black' }} />
        <TabularColumn rows={right} basisLabel={model.basisLabel} />
      </div>

      {micros.length > 0 && (
        <>
          <div style={rule(7, 3)} />
          <MicronutrientRun rows={micros} />
        </>
      )}

      <div style={rule(3, 3)} />
      <div style={{ fontSize: '7px', lineHeight: 1.3 }}>{FOOTNOTE}</div>

      <Statements model={model} />
    </>
  )
}

function LinearPanel({ model }: { model: NfpModel }) {
  const dv = (row: NfpRow) =>
    row.dvPct != null ? <> (<RuleTip rules={[row.dvRule]}>{row.dvPct}</RuleTip> DV)</> : null
  return (
    <>
      <p style={{ fontSize: '10px', lineHeight: 1.45, margin: 0 }}>
        <strong style={{ fontSize: '13px', fontWeight: 900 }}>Nutrition Facts</strong>{' '}
        <RuleTip rules={[model.servingsRule]}>{model.servingsText}</RuleTip>,{' '}
        <strong>Serv. size</strong> <RuleTip rules={[model.servingSizeRule]}>{model.servingSizeText}</RuleTip>,{' '}
        <strong>{model.basisLabel}: Calories</strong> <RuleTip rules={[model.caloriesRule]}>{model.calories}</RuleTip>
        {model.rows.map(row => (
          <span key={row.key}>
            , <RowLabel row={row} short />{dv(row)}
          </span>
        ))}
        .
      </p>
      <Statements model={model} />
    </>
  )
}

export const NfpPanel = forwardRef<HTMLDivElement, NfpPanelProps>(function NfpPanel({ model }, ref) {
  const layout = model.layout ?? 'standard'
  if (layout === 'tabular') {
    return <div ref={ref} style={frame(600, '6px 8px 8px')}><TabularPanel model={model} /></div>
  }
  if (layout === 'linear') {
    return <div ref={ref} style={frame(460, '6px 8px 8px')}><LinearPanel model={model} /></div>
  }
  return <div ref={ref} style={frame(340, '5px 8px 8px')}><StandardPanel model={model} /></div>
})
