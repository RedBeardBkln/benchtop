'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Equipment, ProcessStepDetail } from '@/lib/types'
import {
  cToF, fToC, normalizeTime, stepTime, trimNumber, type StepParams,
} from '@/lib/step-measurements'

const INPUT =
  'w-full px-1.5 py-1 text-xs border border-gray-200 rounded bg-white tabular-nums ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      <label className="block text-[10px] text-gray-400">{label}</label>
      {children}
    </div>
  )
}

type Normalized = { value: string | null } | { error: string }

/** A single-value measurement: edits locally, validates and saves on blur. */
function MeasureField({
  label, saved, disabled, onCommit, normalize, className, type = 'text', tip, ...rest
}: {
  label: string
  /** Hover / focus hint on the box */
  tip?: string
  saved: string
  disabled: boolean
  onCommit: (next: string | null) => void
  normalize?: (raw: string) => Normalized
  className?: string
  type?: string
  placeholder?: string
  min?: string
  max?: string
  step?: string
  maxLength?: number
}) {
  const [draft, setDraft] = useState(saved)
  useEffect(() => { setDraft(saved) }, [saved])

  function commit() {
    const raw = draft.trim()
    let next: string | null = raw || null
    if (normalize && raw) {
      const r = normalize(raw)
      if ('error' in r) {
        toast.error(r.error)
        setDraft(saved)
        return
      }
      next = r.value
    }
    setDraft(next ?? '')
    if ((next ?? '') !== saved) onCommit(next)
  }

  return (
    <Field label={label} className={className}>
      <input
        {...rest}
        type={type}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-label={label}
        data-tip={disabled ? undefined : tip}
        className={INPUT}
      />
    </Field>
  )
}

const fToDisplay = (c: string) => {
  const n = parseFloat(c)
  return Number.isFinite(n) ? trimNumber(cToF(n), 1) : ''
}

/** °C and °F side by side: typing in either fills the other; only °C is stored. */
function TempFields({ savedC, disabled, onCommit }: {
  savedC: string
  disabled: boolean
  onCommit: (c: string | null) => void
}) {
  const [c, setC] = useState(savedC)
  const [f, setF] = useState(fToDisplay(savedC))
  useEffect(() => { setC(savedC); setF(fToDisplay(savedC)) }, [savedC])

  function changeC(v: string) {
    setC(v)
    setF(fToDisplay(v))
  }
  function changeF(v: string) {
    setF(v)
    const n = parseFloat(v)
    setC(Number.isFinite(n) ? trimNumber(fToC(n), 2) : '')
  }
  function commit() {
    const raw = c.trim()
    if (raw !== '' && !Number.isFinite(Number(raw))) {
      toast.error('Temperature must be a number')
      setC(savedC); setF(fToDisplay(savedC))
      return
    }
    if (raw !== savedC) onCommit(raw || null)
  }

  return (
    <>
      <Field label="Temp (°C)" className="w-20">
        <input type="number" step="any" value={c} disabled={disabled} onChange={(e) => changeC(e.target.value)} onBlur={commit}
          aria-label="Temperature (°C)" data-tip={disabled ? undefined : 'Type °C or °F and the other fills in. Saved in °C.'} className={INPUT} />
      </Field>
      <Field label="Temp (°F)" className="w-20">
        <input type="number" step="any" value={f} disabled={disabled} onChange={(e) => changeF(e.target.value)} onBlur={commit}
          aria-label="Temperature (°F)" data-tip={disabled ? undefined : 'Type °F or °C and the other fills in. Saved in °C.'} className={INPUT} />
      </Field>
    </>
  )
}

const NEW_EQUIPMENT = '__new__'
const MANAGE_EQUIPMENT = '__manage__'

/** Equipment dropdown with an "Add new equipment…" option that swaps in a name box. */
function EquipmentField({ equipmentId, equipmentName, options, disabled, onSelect, onCreate, onRefresh, onManage }: {
  equipmentId: string | null
  equipmentName: string | null
  options: Equipment[]
  disabled: boolean
  onSelect: (id: string | null) => void
  onCreate: (name: string) => Promise<void>
  /** Re-fetch the shared list (it may have grown in another tab or formulation). */
  onRefresh: () => void
  /** Open the rename/remove list; omitted when the user can't change the library */
  onManage?: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onCreate(trimmed)
      setAdding(false)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  if (adding) {
    return (
      <Field label="Equipment" className="w-56">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            maxLength={120}
            placeholder="New equipment name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit() }
              if (e.key === 'Escape') { setAdding(false); setName('') }
            }}
            className={INPUT}
          />
          <button type="button" onClick={submit} disabled={busy || !name.trim()}
            data-tip="Adds this to your account’s equipment list and picks it for this step"
            className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-40">
            Add
          </button>
          <button type="button" onClick={() => { setAdding(false); setName('') }}
            className="px-1.5 py-1 text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </Field>
    )
  }

  // A step's own equipment always stays selectable, even if this page's cached list predates it
  const choices: Array<{ id: string; name: string }> = [...options]
  if (equipmentId && equipmentName && !choices.some((eq) => eq.id === equipmentId)) {
    choices.push({ id: equipmentId, name: equipmentName })
  }

  return (
    <Field label="Equipment" className="w-44">
      <select
        value={equipmentId ?? ''}
        disabled={disabled}
        onFocus={onRefresh}
        aria-label="Equipment"
        data-tip={disabled ? undefined : 'The equipment used in this step. The list is shared by everyone on your account.'}
        onChange={(e) => {
          if (e.target.value === NEW_EQUIPMENT) setAdding(true)
          else if (e.target.value === MANAGE_EQUIPMENT) onManage?.()
          else onSelect(e.target.value || null)
        }}
        className={INPUT}
      >
        <option value="">—</option>
        {choices.map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
        {!disabled && <option value={NEW_EQUIPMENT}>+ Add new equipment…</option>}
        {!disabled && onManage && <option value={MANAGE_EQUIPMENT}>Rename or remove equipment…</option>}
      </select>
    </Field>
  )
}

const phNormalize = (raw: string): Normalized => {
  const n = Number(raw)
  return n >= 0 && n <= 14 ? { value: raw } : { error: 'pH must be between 0 and 14' }
}
const speedNormalize = (raw: string): Normalized => {
  const n = Number(raw)
  return n >= 0 ? { value: n.toFixed(2) } : { error: 'Speed must be a number, 0 or greater' }
}
const timeNormalize = (raw: string): Normalized => {
  const t = normalizeTime(raw)
  return t ? { value: t } : { error: 'Time must be hh:mm:ss (e.g. 00:30:00)' }
}

/**
 * The measurement fields for one step, rendered as flex items so they sit on the same
 * row as the loss controls (the parent is a wrapping flex container).
 */
export function StepMeasurements({
  step, disabled, equipment, onPatch, onSelectEquipment, onCreateEquipment, onRefreshEquipment, onManageEquipment,
}: {
  step: ProcessStepDetail
  disabled: boolean
  equipment: Equipment[]
  /** Merge these keys into the step's params; null clears a key. */
  onPatch: (params: Record<string, string | null>) => void
  onSelectEquipment: (id: string | null) => void
  onCreateEquipment: (name: string) => Promise<void>
  onRefreshEquipment: () => void
  onManageEquipment?: () => void
}) {
  const p = (step.params ?? {}) as StepParams
  const one = (key: keyof StepParams) => (v: string | null) => onPatch({ [key]: v })

  return (
    <>
      <MeasureField label="Start" type="time" className="w-28" saved={p.start_time ?? ''} disabled={disabled} onCommit={one('start_time')} tip="Time of day this step started. Saves when you click away." />
      <MeasureField label="End" type="time" className="w-28" saved={p.end_time ?? ''} disabled={disabled} onCommit={one('end_time')} tip="Time of day this step finished. Saves when you click away." />
      <MeasureField label="pH" type="number" step="0.01" min="0" max="14" className="w-16" saved={p.ph ?? ''} disabled={disabled} normalize={phNormalize} onCommit={one('ph')} tip="pH measured at this step, 0 to 14" />
      <TempFields savedC={p.temp_c ?? ''} disabled={disabled} onCommit={one('temp_c')} />
      <MeasureField
        label="Time (hh:mm:ss)" placeholder="00:00:00" className="w-28" saved={stepTime(p) ?? ''} disabled={disabled}
        normalize={timeNormalize} onCommit={(v) => onPatch({ time: v, time_min: null })}
        tip="How long this step takes, as hours:minutes:seconds, e.g. 00:30:00"
      />
      <MeasureField label="Speed" type="number" step="0.01" min="0" placeholder="0.00" className="w-20" saved={p.speed ?? ''} disabled={disabled} normalize={speedNormalize} onCommit={one('speed')} tip="Mixer or equipment speed setting, a number (saved to 2 decimals)" />
      <EquipmentField
        equipmentId={step.equipmentId} equipmentName={step.equipmentName} options={equipment} disabled={disabled}
        onSelect={onSelectEquipment} onCreate={onCreateEquipment} onRefresh={onRefreshEquipment}
        onManage={onManageEquipment}
      />
      <MeasureField label="Notes" maxLength={2000} className="basis-full" saved={p.notes ?? ''} disabled={disabled} onCommit={one('notes')} />
    </>
  )
}
