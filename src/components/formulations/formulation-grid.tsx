'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Save, Plus, X, Trash2, ChevronDown, ChevronUp, ChevronRight, Lock,
  Database, ArrowLeftRight, GitBranch, Target, CheckCircle2, XCircle, AlertCircle,
  GripVertical, ArrowDownNarrowWide, Zap, Archive, Unlock, Edit2, FileText, Printer, PackagePlus, RotateCcw,
} from 'lucide-react'
import type { FormulationDetail, IngredientDetail, IngredientListRow, Nutrient, ProjectTarget } from '@/lib/types'
import { categoryPath, onHandAlternatives } from '@/lib/ingredient-categories'
import { calcNutrientContributions, calcNutrientProfile, dryBasisFactor, formatAmt, type NutrientContribution } from '@/lib/formulation-calc'
import { toLossStep } from '@/lib/process-loss'
import { formatWeightG } from '@/lib/weight'
import { CompanyLogo } from '@/components/company-logo'
import { WeightInput } from '@/components/formulations/weight-input'
import { StickyXScroll } from '@/components/sticky-x-scroll'
import {
  MASS_UNITS, UNIT_LABELS, VOLUME_UNITS, effectiveUnit, formatGramsIn, isVolumeUnit, isWeightUnit,
  type WeightUnit,
} from '@/lib/weight-units'
import { PctInput } from '@/components/formulations/pct-input'
import { LockToggle } from '@/components/formulations/lock-toggle'
import { resolveLines, type Anchor } from '@/lib/formula-lock'
import { PCT_DECIMALS_MIN, PCT_DECIMALS_MAX, readPctDecimals, writePctDecimals } from '@/lib/pct-display'
import { CATEGORY_ORDER, evaluateTargets, fmtBasis, fmtRequirement, type ValidationStatus } from '@/lib/target-validation'
import { withUnit } from '@/lib/units'
import { serializePrintSections, type PrintSection } from '@/lib/print-sections'
import type { SolverResult } from '@/lib/solver'
import { IngredientSidePanel } from '@/components/ingredients/ingredient-side-panel'
import { ProcessStepsPanel } from '@/components/formulations/process-steps-panel'
import { IterationNote } from '@/components/formulations/iteration-note'
import { GridColumnPicker } from '@/components/formulations/grid-column-picker'
import { readErrorMessage } from '@/lib/utils'
import { useUnsavedChangesWarning } from '@/lib/use-unsaved-changes-warning'
import { GLOSSARY } from '@/lib/glossary'
import { Term } from '@/components/term'

function statusIcon(s: ValidationStatus) {
  if (s === 'pass') return <CheckCircle2 size={14} className="text-green-500" />
  if (s === 'fail') return <XCircle size={14} className="text-red-500" />
  if (s === 'warn') return <AlertCircle size={14} className="text-yellow-500" />
  return <span className="text-gray-300 text-xs">—</span>
}

const STATUS_TIP: Record<ValidationStatus, string> = {
  pass: GLOSSARY.pass,
  warn: GLOSSARY.warn,
  fail: GLOSSARY.fail,
  'no-data': 'Can’t check yet: no value for this nutrient, or no serving size for a per-serving target.',
}

const AUDIT_TIP = {
  satisfied: 'Satisfied: the target is met with room to spare.',
  binding: 'Binding: met, but right at the limit.',
  violated: 'Violated: the suggestion misses this target.',
  'no-data': 'No data for this nutrient, so it couldn’t be checked.',
} as const

import { AddIngredientDialog } from '@/components/ingredients/add-ingredient-dialog'
import { UsdaSearchDialog } from '@/components/ingredients/usda-search-dialog'
import { SwapSourceDialog, LibraryPickerDialog } from '@/components/formulations/swap-source-dialog'
import { ReverseWizard } from '@/components/formulations/reverse-wizard'
import { NfpDialog } from '@/components/formulations/nfp-dialog'
import { CompleteBatchDialog } from '@/components/formulations/complete-batch-dialog'
import { SaveAsIngredientDialog } from '@/components/formulations/save-as-ingredient-dialog'
import { PrintOptionsDialog } from '@/components/formulations/print-options-dialog'
import { CogsPanel } from '@/components/formulations/cogs-panel'
import { SolverBoundsDialog } from '@/components/formulations/solver-bounds-dialog'
import { CompareVersionsDialog } from '@/components/formulations/compare-versions-dialog'
import { BatchHistoryPanel, batchRunsKey } from '@/components/formulations/batch-history-panel'
import { usePreferences } from '@/lib/use-preferences'

// Nutrient columns the grid shows until the formulation picks its own
const DEFAULT_GRID_NUTRIENT_NAMES = ['Energy', 'Protein', 'Total Fat', 'Total Carbohydrate', 'Dietary Fiber']

// Shorter grid headers for long nutrient names
const GRID_HEADER_LABELS: Record<string, string> = { 'Total Carbohydrate': 'Carbs' }

function UnitOptions({ needsDensity = false }: { needsDensity?: boolean }) {
  return (
    <>
      <optgroup label="Weight">
        {MASS_UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
      </optgroup>
      <optgroup label={needsDensity ? 'Volume (asks for the density)' : 'Volume'}>
        {VOLUME_UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
      </optgroup>
    </>
  )
}

/** Asks for an ingredient's density (g per mL), which a volume unit needs */
function DensityDialog({ ingredientName, unit, canEditLibrary, saving, onSave, onClose }: {
  ingredientName: string
  unit: WeightUnit
  canEditLibrary: boolean
  saving: boolean
  onSave: (density: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const density = parseFloat(value)
  const valid = density > 0 && density <= 100
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={e => { e.preventDefault(); if (valid) onSave(density) }}
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Density needed</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-600">
          To show <span className="font-medium text-gray-800">{ingredientName}</span> in {UNIT_LABELS[unit]}, Benchtop needs
          its density: how many grams one milliliter weighs. Water is 1; most oils are about 0.92 and honey about 1.42.
        </p>
        {canEditLibrary ? (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Density</span>
              <span className="flex items-center gap-2">
                <input
                  autoFocus inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 1.03"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">g/mL</span>
              </span>
            </label>
            <p className="text-xs text-gray-500">It’s saved to the ingredient in your library, so every formula can use it.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={!valid || saving}
                data-tip={valid ? 'Saves the density and switches this ingredient to the volume unit' : 'Enter a density greater than 0'}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : `Save and use ${UNIT_LABELS[unit]}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-amber-700">You can’t edit the ingredient library, so ask someone who can to add its density.</p>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Close</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

const numOrNull = (s: string | null | undefined) => (s != null && s !== '' ? parseFloat(s) : null)


type LineState = {
  key: string           // stable React key (uuid or temp)
  ingredientId: string
  ingredientName: string
  ingredientVerification: string
  position: number
  weightG: number
  weightUnit: WeightUnit | null  // this line's own display unit; null = the column's
  densityGPerMl: number | null   // the ingredient's, for volume units
  moisturePct: number | null     // the ingredient's, for dry-basis targets
  locked: boolean          // quantity lock: keeps its grams
  pctLocked: boolean       // %-lock: always `lockedPct` % of the batch
  lockedPct: number | null
  // Usage limits Solve must keep to (null = no limit)
  minPct: number | null
  maxPct: number | null
  nutrients: Array<{ nutrientId: string; amountPer100g: number; name: string; unit: string; category: string }>
}

function IngredientSearchDropdown({
  onSelect,
  onClose,
  onAddManually,
  onImportUsda,
}: {
  onSelect: (ing: { id: string; name: string; verification: string; nutrients: LineState['nutrients'] }) => void
  onClose: () => void
  onAddManually: (query: string) => void
  onImportUsda: (query: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{
    id: string; name: string; verification: string; onHand: boolean
    category: string | null; subcategory: string | null; microCategory: string | null
  }>>([])
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/ingredients?q=${encodeURIComponent(query)}&limit=8`)
      if (r.ok) setResults(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  async function pick(ing: { id: string; name: string; verification: string }) {
    const r = await fetch(`/api/ingredients/${ing.id}`)
    if (!r.ok) { toast.error('Could not load ingredient'); return }
    const detail = await r.json()
    onSelect({
      id: ing.id,
      name: ing.name,
      verification: ing.verification,
      nutrients: detail.nutrients.map((n: {
        nutrientId: string
        amountPer100g: string
        nutrient: { id: string; name: string; unit: string; category: string }
      }) => ({
        nutrientId: n.nutrientId,
        amountPer100g: parseFloat(n.amountPer100g),
        name: n.nutrient.name,
        unit: n.nutrient.unit,
        category: n.nutrient.category,
      })),
    })
  }

  const showDropdown = isFocused || results.length > 0 || query.trim().length > 0

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        placeholder="Search ingredients…"
        className="w-56 px-3 py-1.5 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showDropdown && (
        <div className="absolute z-20 top-full mt-1 left-0 w-72 bg-white border border-gray-200
                        rounded-lg shadow-lg overflow-hidden">
          {results.map(ing => (
            <button
              key={ing.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(ing)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between border-b border-gray-50"
            >
              <span className="min-w-0">
                <span className="block font-medium text-gray-800 truncate">{ing.name}</span>
                {ing.category && <span className="block text-xs text-gray-400 truncate">{categoryPath(ing)}</span>}
              </span>
              <span className="flex items-center gap-1.5 shrink-0 ml-2">
                {ing.onHand && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700" data-tip={GLOSSARY.onHand}>On hand</span>
                )}
                {ing.verification === 'verified' && (
                  <span className="text-xs text-green-600" data-tip={GLOSSARY.verified} aria-label="Verified">✓</span>
                )}
              </span>
            </button>
          ))}
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No ingredients found</div>
          )}
          <div className="border-t border-gray-100 bg-gray-50">
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onClose(); onAddManually(query) }}
              data-tip="Type in a new ingredient. It’s added to your library and to this formulation."
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-2"
            >
              <Plus size={13} className="text-blue-500 shrink-0" />
              Add manually
            </button>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onClose(); onImportUsda(query) }}
              data-tip="Look it up in USDA FoodData Central. It’s added to your library and to this formulation."
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-2 border-t border-gray-100"
            >
              <Database size={13} className="text-blue-500 shrink-0" />
              Import from USDA
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Per-ingredient breakdown of one nutrient, shown under its row in the full nutrient profile. */
function NutrientContributionList({
  contributions, unit, servingSizeG, totalLines,
}: {
  contributions: NutrientContribution<LineState>[]
  unit: string
  servingSizeG: number | null
  totalLines: number
}) {
  if (contributions.length === 0) {
    return <p className="text-xs text-gray-400 pl-4">No ingredient contributes this nutrient.</p>
  }
  const others = totalLines - contributions.length
  return (
    <div className="pl-4 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-gray-400">
          <tr>
            <th className="text-left font-medium py-1">Ingredient</th>
            <th className="text-left font-medium py-1 w-2/5 min-w-32">
              <Term tip="This ingredient’s part of the formulation’s total for this nutrient.">Share</Term>
            </th>
            <th className="text-right font-medium py-1 pl-3">
              <Term tip="How much of this nutrient the ingredient adds to the whole batch.">In batch</Term>
            </th>
            <th className="text-right font-medium py-1 pl-3"><Term t="per100gFinished">Per 100 g</Term></th>
            {servingSizeG && <th className="text-right font-medium py-1 pl-3"><Term t="perServing">Per serving</Term></th>}
          </tr>
        </thead>
        <tbody>
          {contributions.map(c => (
            <tr key={c.line.key}>
              <td className="py-0.5 pr-3 text-gray-700">{c.line.ingredientName}</td>
              <td className="py-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.sharePct}%` }} />
                  </div>
                  <span className="w-12 text-right tabular-nums text-gray-600">{c.sharePct.toFixed(1)}%</span>
                </div>
              </td>
              <td className="py-0.5 pl-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{formatAmt(c.inBatch, unit)} {unit}</td>
              <td className="py-0.5 pl-3 text-right tabular-nums text-gray-600">{formatAmt(c.perFinished100g, unit)}</td>
              {servingSizeG && (
                <td className="py-0.5 pl-3 text-right tabular-nums text-gray-600">
                  {formatAmt((c.perFinished100g * servingSizeG) / 100, unit)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {others > 0 && (
        <p className="mt-1 text-[11px] text-gray-400">
          Other ingredients ({others}) contribute none or have no value for this nutrient.
        </p>
      )}
    </div>
  )
}

/** " (note…)" suffix for the version dropdown; empty when the iteration has no note. */
function iterationLabel(note: string | null): string {
  const flat = note?.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  return ` (${flat.length > 40 ? `${flat.slice(0, 40).trimEnd()}…` : flat})`
}

export function FormulationGrid({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [lines, setLines] = useState<LineState[]>([])
  const [batchLocked, setBatchLocked] = useState(false)
  const [batchTargetG, setBatchTargetG] = useState<number | null>(null)   // the locked batch size
  const [pctDecimals, setPctDecimals] = useState(PCT_DECIMALS_MIN)
  useEffect(() => { setPctDecimals(readPctDecimals()) }, [])
  const [servingSizeG, setServingSizeG] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  // Profile rows expanded to show each ingredient's contribution
  const [expandedNutrients, setExpandedNutrients] = useState<Set<string>>(new Set())
  // null = the default columns
  const [gridNutrientIds, setGridNutrientIds] = useState<string[] | null>(null)
  // Unit the amount column is shown and typed in. Like the columns, a view choice saved straight away.
  const [columnUnit, setColumnUnit] = useState<WeightUnit>('g')
  // A line waiting for its ingredient's density before it can switch to a volume unit
  const [densityPrompt, setDensityPrompt] = useState<{ key: string; unit: WeightUnit } | null>(null)
  const gridSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualInitialName, setManualInitialName] = useState('')
  const [showUsdaDialog, setShowUsdaDialog] = useState(false)
  const [usdaInitialQuery, setUsdaInitialQuery] = useState('')
  const [swapTargetKey, setSwapTargetKey] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null)
  const [showSolverPanel, setShowSolverPanel] = useState(false)
  const [showSolverBounds, setShowSolverBounds] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showReverseWizard, setShowReverseWizard] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'unfinalize' | 'archive' | 'archive-iteration' | null>(null)
  const [showArchiveMenu, setShowArchiveMenu] = useState(false)
  const [sidebarIngredientId, setSidebarIngredientId] = useState<string | null>(null)
  const [sidebarLineKey, setSidebarLineKey] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameEdit, setNameEdit] = useState('')
  const [showNfpDialog, setShowNfpDialog] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showDuplicateMenu, setShowDuplicateMenu] = useState(false)
  const [showNewFormulation, setShowNewFormulation] = useState(false)
  const [newFormulationName, setNewFormulationName] = useState('')
  const [showCompleteBatch, setShowCompleteBatch] = useState(false)
  const [showSaveAsIngredient, setShowSaveAsIngredient] = useState(false)
  const [showSwapSourceDialog, setShowSwapSourceDialog] = useState(false)
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [swapIngredientName, setSwapIngredientName] = useState('')
  const initDoneRef = useRef(false)
  // COGS tab, shown only to users who turned it on in Settings → Preferences
  const { prefs } = usePreferences()
  const [tab, setTab] = useState<'formula' | 'cogs'>('formula')
  const activeTab = prefs.showCogs ? tab : 'formula'

  const { data, isLoading, error } = useQuery<FormulationDetail>({
    queryKey: ['formulation', id],
    queryFn: () =>
      fetch(`/api/formulations/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

  // A reverse-wizard session saved to finish later (same query the wizard uses)
  const { data: reverseDraft } = useQuery<{ draft: unknown; savedAt: string | null }>({
    queryKey: ['reverse-draft', id],
    queryFn: () => fetch(`/api/formulations/${id}/reverse-draft`)
      .then(r => (r.ok ? r.json() : { draft: null, savedAt: null })),
    enabled: data?.mode === 'reverse',
  })
  const hasReverseDraft = !!reverseDraft?.draft

  // The library, for on-hand status and on-hand alternatives to each line
  const { data: library = [] } = useQuery<IngredientListRow[]>({
    queryKey: ['ingredients'],
    queryFn: () => fetch('/api/ingredients').then(r => r.json()),
  })
  const libraryById = useMemo(() => new Map(library.map(i => [i.id, i])), [library])

  const { data: allNutrients } = useQuery<Nutrient[]>({
    queryKey: ['nutrients-all'],
    queryFn: () => fetch('/api/nutrients').then(r => r.json()),
    staleTime: Infinity,
  })

  // Initialize state from server data
  useEffect(() => {
    if (!data || initDoneRef.current) return
    initDoneRef.current = true
    setLines(
      data.lines.map(l => ({
        key: l.id,
        ingredientId: l.ingredientId,
        ingredientName: l.ingredientName,
        ingredientVerification: l.ingredientVerification,
        position: l.position,
        weightG: parseFloat(l.weightG),
        weightUnit: isWeightUnit(l.weightUnit) ? l.weightUnit : null,
        densityGPerMl: l.ingredientDensityGPerMl != null ? parseFloat(l.ingredientDensityGPerMl) : null,
        moisturePct: numOrNull(l.ingredientMoisturePct),
        locked: l.locked,
        pctLocked: l.pctLocked,
        lockedPct: l.pctLocked ? parseFloat(l.pct) : null,
        minPct: l.minPct != null ? parseFloat(l.minPct) : null,
        maxPct: l.maxPct != null ? parseFloat(l.maxPct) : null,
        nutrients: l.nutrients.map(n => ({
          nutrientId: n.nutrientId,
          amountPer100g: parseFloat(n.amountPer100g),
          name: n.name,
          unit: n.unit,
          category: n.category,
        })),
      }))
    )
    setServingSizeG(data.servingSizeG ? String(parseFloat(data.servingSizeG)) : '')
    setBatchLocked(data.batchLocked)
    setGridNutrientIds(data.gridNutrientIds ?? null)
    setColumnUnit(isWeightUnit(data.weightUnit) ? data.weightUnit : 'g')
    setBatchTargetG(data.batchLocked && data.batchSizeG ? parseFloat(data.batchSizeG) : null)
    // Auto-launch wizard for new reverse-mode formulations with no lines yet
    if (data.mode === 'reverse' && data.lines.length === 0) {
      setShowReverseWizard(true)
    }
  }, [data])

  // Derived values
  const totalWeightG = useMemo(() => lines.reduce((s, l) => s + (l.weightG || 0), 0), [lines])

  // Why the current locks can't all be honored (null when they can, or when nothing is locked)
  const lockProblem = useMemo(() => {
    if (!batchLocked && !lines.some(l => l.pctLocked)) return null
    return resolveLines({ lines, batchLocked, batchG: batchTargetG }).problem
  }, [lines, batchLocked, batchTargetG])

  // Saved process steps drive yield: each step's loss shifts the finished weight and/or profile
  const processSteps = useMemo(() => data?.processSteps ?? [], [data?.processSteps])

  const calcResult = useMemo(() => {
    if (!allNutrients || lines.length === 0) return null
    return calcNutrientProfile({
      lines: lines.map(l => ({ ingredientId: l.ingredientId, weightG: l.weightG, nutrients: l.nutrients, moisturePct: l.moisturePct })),
      allNutrients: allNutrients.map(n => ({
        id: n.id, name: n.name, unit: n.unit, category: n.category,
        dailyValueAmount: n.dailyValueAmount != null ? Number(n.dailyValueAmount) : null,
      })),
      servingSizeG: servingSizeG ? parseFloat(servingSizeG) : undefined,
      steps: processSteps.map(toLossStep),
    })
  }, [lines, allNutrients, servingSizeG, processSteps])

  // Grid nutrient columns
  const gridNutrients = useMemo(() => {
    if (!allNutrients) return []
    if (gridNutrientIds) return allNutrients.filter(n => gridNutrientIds.includes(n.id))
    return DEFAULT_GRID_NUTRIENT_NAMES
      .map(name => allNutrients.find(n => n.name === name))
      .filter(Boolean) as Nutrient[]
  }, [allNutrients, gridNutrientIds])

  // Nutrients at least one ingredient in the formula has a value for
  const presentNutrientIds = useMemo(
    () => new Set(lines.flatMap(l => l.nutrients.map(n => n.nutrientId))),
    [lines],
  )

  // The column view saves itself (debounced) — it's a view setting, separate from the Save button
  const gridColumnsMutation = useMutation({
    mutationFn: (ids: string[] | null) =>
      fetch(`/api/formulations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gridNutrientIds: ids }),
      }).then(async r => { if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save the column view')) }),
    onSuccess: (_r, ids) => {
      queryClient.setQueryData<FormulationDetail>(['formulation', id], old => old && { ...old, gridNutrientIds: ids })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const pendingGridIdsRef = useRef<{ ids: string[] | null } | null>(null)

  function changeGridColumns(ids: string[] | null) {
    setGridNutrientIds(ids)
    // View-only members can change their own column view, but it isn't saved for everyone
    if (data?.canEdit === false) return
    pendingGridIdsRef.current = { ids }
    if (gridSaveTimerRef.current) clearTimeout(gridSaveTimerRef.current)
    gridSaveTimerRef.current = setTimeout(() => void flushGridColumns(), 600)
  }

  // Leaving the page (e.g. switching iteration) mid-debounce still saves the change
  useEffect(() => () => {
    if (gridSaveTimerRef.current) clearTimeout(gridSaveTimerRef.current)
    const pending = pendingGridIdsRef.current
    if (!pending) return
    queryClient.setQueryData<FormulationDetail>(['formulation', id], old => old && { ...old, gridNutrientIds: pending.ids })
    fetch(`/api/formulations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gridNutrientIds: pending.ids }),
      keepalive: true,
    }).catch(() => {})
  }, [id, queryClient])

  // Saves a column change that is still waiting on the debounce (so a new iteration copies it)
  async function flushGridColumns() {
    if (gridSaveTimerRef.current) clearTimeout(gridSaveTimerRef.current)
    gridSaveTimerRef.current = null
    const pending = pendingGridIdsRef.current
    pendingGridIdsRef.current = null
    if (pending) await gridColumnsMutation.mutateAsync(pending.ids).catch(() => {})
  }

  function changeColumnUnit(unit: WeightUnit) {
    setColumnUnit(unit)
    queryClient.setQueryData<FormulationDetail>(['formulation', id], old => old && { ...old, weightUnit: unit })
    // View-only members can switch units for themselves, but it isn't saved for everyone
    if (data?.canEdit === false) return
    fetch(`/api/formulations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightUnit: unit }),
    }).then(r => { if (!r.ok) toast.error('Could not save the unit') }).catch(() => toast.error('Could not save the unit'))
  }

  // Gives one line its own unit (null follows the column again); saved with the formula
  function changeLineUnit(key: string, unit: WeightUnit | null) {
    const line = lines.find(l => l.key === key)
    if (!line) return
    if (unit && isVolumeUnit(unit) && !line.densityGPerMl) { setDensityPrompt({ key, unit }); return }
    setLines(prev => prev.map(l => (l.key === key ? { ...l, weightUnit: unit } : l)))
    markDirty()
  }

  // Saves the ingredient's density to the library, then switches the line to the volume unit
  const saveDensity = useMutation({
    mutationFn: async ({ ingredientId, density }: { ingredientId: string; density: number }) => {
      const r = await fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ densityGPerMl: density }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save the density'))
    },
    onSuccess: (_r, { ingredientId, density }) => {
      const prompt = densityPrompt
      setLines(prev => prev.map(l => (l.ingredientId === ingredientId
        ? { ...l, densityGPerMl: density, ...(prompt && l.key === prompt.key ? { weightUnit: prompt.unit } : {}) }
        : l)))
      if (prompt) markDirty()
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['ingredient', ingredientId] })
      setDensityPrompt(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function toggleNutrientExpanded(nutrientId: string) {
    setExpandedNutrients(prev => {
      const next = new Set(prev)
      if (next.has(nutrientId)) next.delete(nutrientId)
      else next.add(nutrientId)
      return next
    })
  }

  // New iteration: next version of this same formulation
  const iterateMutation = useMutation({
    mutationFn: async () => {
      await flushGridColumns()
      return fetch(`/api/formulations/${id}/iterate`, { method: 'POST' }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Could not create iteration')
        return body
      })
    },
    onSuccess: (iteration) => {
      // Refresh the iteration list on every version of this family, plus project counts
      queryClient.invalidateQueries({ queryKey: ['formulation'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(`v${iteration.version} created — opening now`)
      router.push(`/formulations/${iteration.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // New formulation: separate formulation under a new name, starting at v1
  const forkMutation = useMutation({
    mutationFn: async (name: string) => {
      await flushGridColumns()
      return fetch(`/api/formulations/${id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Could not create formulation')
        return body
      })
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowNewFormulation(false)
      toast.success(`"${created.name}" created — opening now`)
      router.push(`/formulations/${created.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function requireSavedChanges(): boolean {
    if (isDirty) {
      toast.warning('Save your changes first — duplicating copies the last saved version')
      return false
    }
    return true
  }

  const finalizeMutation = useMutation({
    mutationFn: (status: 'locked' | 'draft') =>
      fetch(`/api/formulations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(async r => { if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed')); return r.json() }),
    onSuccess: (_row, status) => {
      // status is shown on sibling iterations (version dropdown) and on the project page
      queryClient.invalidateQueries({ queryKey: ['formulation'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setConfirmAction(null)
      toast.success(status === 'locked' ? 'Formulation finalized and locked' : 'Formulation unlocked')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const archiveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/formulations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      }).then(async r => { if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed')); return r.json() }),
    onSuccess: () => {
      // archive is family-wide; the project page must show it without waiting for staleTime
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setConfirmAction(null)
      toast.success('Formulation archived')
      router.push(`/projects/${data?.projectId}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Archive or restore just this iteration; the formulation's other iterations stay live
  const iterationArchiveMutation = useMutation({
    mutationFn: (archived: boolean) =>
      fetch(`/api/formulations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iterationArchived: archived }),
      }).then(async r => { if (!r.ok) throw new Error(await readErrorMessage(r, 'Failed')); return r.json() }),
    onSuccess: (_row, archived) => {
      // the version dropdown on every sibling, and the project page's latest iteration, change
      queryClient.invalidateQueries({ queryKey: ['formulation'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setConfirmAction(null)
      if (archived) {
        toast.success(`v${data?.version} archived`)
        const next = data?.iterations.find(it => it.id !== id && !it.iterationArchivedAt)
        if (next) router.push(`/formulations/${next.id}`)
      } else {
        toast.success(`v${data?.version} restored`)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // LP solver mutation
  const solveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/formulations/${id}/solve`, { method: 'POST' }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Solver request failed')
        return body as SolverResult
      }),
    onSuccess: (result) => {
      setSolverResult(result)
      setShowSolverPanel(true)
      if (result.status === 'optimal') toast.success(`Optimal solution found in ${result.solveTimeMs}ms`)
      else if (result.status === 'infeasible') toast.error('No feasible solution — see solver panel')
      else toast.error(result.message ?? 'Solver error')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function applySolution(result: SolverResult) {
    applyLines(lines.map(l => {
      const sugPct = result.suggestedPcts[l.ingredientId]
      if (sugPct == null) return l
      const newWeightG = Math.round(((sugPct / 100) * totalWeightG) * 10) / 10
      return { ...l, weightG: newWeightG }
    }))
    setShowSolverPanel(false)
    setSolverResult(null)
    markDirty()
    toast.success('Solution applied — save to persist')
  }

  // Save mutation
  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/formulations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(async r => { if (!r.ok) throw new Error('Failed'); return r.json() }),
    onSuccess: () => {
      // name is family-wide: sibling iterations and the project page show it too
      queryClient.invalidateQueries({ queryKey: ['formulation'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setEditingName(false)
      toast.success('Formulation renamed')
    },
    onError: () => toast.error('Failed to rename formulation'),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sortedLines = [...lines].sort((a, b) => a.position - b.position)
      await fetch(`/api/formulations/${id}/lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: sortedLines.map((l, i) => ({
            ingredientId: l.ingredientId,
            position: i + 1,
            weightG: l.weightG,
            locked: l.locked,
            pctLocked: l.pctLocked,
            weightUnit: l.weightUnit,
            lockedPct: l.pctLocked ? l.lockedPct : null,
            minPct: l.minPct,
            maxPct: l.maxPct,
          })),
        }),
      }).then(async r => {
        if (!r.ok) throw new Error(await readErrorMessage(r, 'Save failed'))
      })

      // Also save formulation settings
      const patchBody: Record<string, unknown> = {}
      if (servingSizeG) patchBody.servingSizeG = parseFloat(servingSizeG)
      else patchBody.servingSizeG = null
      patchBody.batchLocked = batchLocked
      patchBody.batchSizeG = batchLocked ? batchTargetG : null

      await fetch(`/api/formulations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulation', id] })
      // The project page lists each formulation's updatedAt (and sorts by it)
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setIsDirty(false)
      toast.success('Formulation saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function markDirty() { setIsDirty(true) }

  // The grid keeps each line's nutrient values from when the page loaded; after they're edited in
  // the side panel, load the new ones so totals update. Not an edit to the formula, so not dirty.
  async function refreshLineNutrients(ingredientId: string) {
    const r = await fetch(`/api/ingredients/${ingredientId}`)
    if (!r.ok) return
    const ing: IngredientDetail = await r.json()
    const nutrients = ing.nutrients.map(n => ({
      nutrientId: n.nutrientId,
      amountPer100g: parseFloat(n.amountPer100g),
      name: n.nutrient.name,
      unit: n.nutrient.unit,
      category: n.nutrient.category,
    }))
    setLines(prev => prev.map(l => (l.ingredientId === ingredientId ? { ...l, nutrients } : l)))
  }

  // Grid edits only persist on Save, so leaving with unsaved ones asks first
  const confirmLeave = useUnsavedChangesWarning(isDirty)

  function handlePrint() {
    setShowPrintDialog(true)
  }

  // window.open must stay synchronous inside this click handler (popup blockers)
  function handlePrintConfirm(sections: PrintSection[]) {
    setShowPrintDialog(false)
    if (isDirty) {
      toast.warning('Showing last saved version — save your changes to include them in the printout')
    }
    window.open(`/formulations/${id}/print?sections=${serializePrintSections(sections)}`, '_blank')
  }

  /**
   * Set the formula's lines, first rebalancing for any locked quantities / % / batch size.
   * `anchor` is the value the user just typed (it wins); `batch` overrides the batch lock for this
   * one pass (used to rescale to a typed batch size without locking it).
   */
  function applyLines(next: LineState[], anchor?: Anchor, batch?: { locked: boolean; g: number | null }) {
    const bl = batch ? batch.locked : batchLocked
    const bg = batch ? batch.g : batchTargetG
    if (!bl && !next.some(l => l.pctLocked) && anchor?.kind !== 'pct') {
      setLines(next)
      return
    }
    const res = resolveLines({ lines: next, batchLocked: bl, batchG: bg, anchor })
    setLines(next.map(l => ({ ...l, weightG: res.weights[l.key] ?? l.weightG })))
    if (res.clamped) {
      toast.info('The batch size is locked, so that value was adjusted to fit the other locked values', { id: 'lock-clamped' })
    }
  }

  function updateWeight(key: string, value: string) {
    const w = parseFloat(value)
    const g = isNaN(w) ? 0 : w
    applyLines(lines.map(l => l.key === key ? { ...l, weightG: g } : l), { key, kind: 'qty', value: g })
    markDirty()
  }

  // Typing a usage %: the line's quantity follows. A %-locked line changes its locked value instead.
  function updatePct(key: string, pct: number) {
    const line = lines.find(l => l.key === key)
    if (!line) return
    if (line.pctLocked) {
      applyLines(lines.map(l => l.key === key ? { ...l, lockedPct: pct } : l))
    } else {
      applyLines(lines, { key, kind: 'pct', value: pct })
    }
    markDirty()
  }

  function toggleQtyLock(key: string) {
    applyLines(lines.map(l => l.key === key
      ? { ...l, locked: !l.locked, pctLocked: false, lockedPct: null }
      : l))
    markDirty()
  }

  function togglePctLock(key: string) {
    const line = lines.find(l => l.key === key)
    if (!line) return
    if (!line.pctLocked && !(totalWeightG > 0 && line.weightG > 0)) {
      toast.error('Enter a quantity or a usage % first, then lock it')
      return
    }
    applyLines(lines.map(l => {
      if (l.key !== key) return l
      if (l.pctLocked) return { ...l, pctLocked: false, lockedPct: null }
      return { ...l, pctLocked: true, locked: false, lockedPct: Math.round((l.weightG / totalWeightG) * 100 * 1e4) / 1e4 }
    }))
    markDirty()
  }

  function toggleBatchLock() {
    if (batchLocked) {
      setBatchLocked(false)
      setBatchTargetG(null)
    } else {
      const g = batchTargetG ?? Math.round(totalWeightG * 1e4) / 1e4
      if (!(g > 0)) {
        toast.error('Add ingredients first, then lock the batch size')
        return
      }
      setBatchLocked(true)
      setBatchTargetG(g)
      applyLines(lines, undefined, { locked: true, g })
    }
    markDirty()
  }

  // A typed batch size rescales the formula once (and becomes the target if the batch is locked)
  function commitBatchSize(g: number) {
    if (!(g > 0)) return
    if (batchLocked) setBatchTargetG(g)
    applyLines(lines, undefined, { locked: true, g })
    markDirty()
  }

  function changePctDecimals(delta: number) {
    const next = Math.min(PCT_DECIMALS_MAX, Math.max(PCT_DECIMALS_MIN, pctDecimals + delta))
    setPctDecimals(next)
    writePctDecimals(next)
  }

  function removeLine(key: string) {
    applyLines(lines.filter(l => l.key !== key).map((l, i) => ({ ...l, position: i + 1 })))
    markDirty()
  }

  function addIngredient(ing: { id: string; name: string; verification: string; nutrients: LineState['nutrients'] }) {
    // Prevent duplicate
    if (lines.some(l => l.ingredientId === ing.id)) {
      toast.error(`${ing.name} is already in this formulation`)
      return
    }
    const newLine: LineState = {
      key: `new-${Date.now()}`,
      ingredientId: ing.id,
      ingredientName: ing.name,
      ingredientVerification: ing.verification,
      position: lines.length + 1,
      weightG: 0,
      weightUnit: null,
      densityGPerMl: numOrNull(libraryById.get(ing.id)?.densityGPerMl),
      moisturePct: numOrNull(libraryById.get(ing.id)?.moisturePct),
      locked: false,
      pctLocked: false,
      lockedPct: null,
      minPct: null,
      maxPct: null,
      nutrients: ing.nutrients,
    }
    applyLines([...lines, newLine])
    setShowAddRow(false)
    markDirty()
  }

  async function addIngredientById(id: string) {
    try {
      const r = await fetch(`/api/ingredients/${id}`)
      if (!r.ok) { toast.error('Could not load ingredient'); return }
      const detail = await r.json()
      addIngredient({
        id: detail.id,
        name: detail.name,
        verification: detail.verification,
        nutrients: (detail.nutrients ?? []).map((n: {
          nutrientId: string
          amountPer100g: string
          nutrient: { id: string; name: string; unit: string; category: string }
        }) => ({
          nutrientId: n.nutrientId,
          amountPer100g: parseFloat(n.amountPer100g),
          name: n.nutrient.name,
          unit: n.nutrient.unit,
          category: n.nutrient.category,
        })),
      })
    } catch {
      toast.error('Could not add ingredient')
    }
  }

  async function swapLineById(lineKey: string, id: string) {
    const existing = lines.find(l => l.ingredientId === id && l.key !== lineKey)
    if (existing) {
      toast.error(`${existing.ingredientName} is already in this formulation — remove one line or pick a different ingredient`)
      return
    }
    try {
      const r = await fetch(`/api/ingredients/${id}`)
      if (!r.ok) { toast.error('Could not load ingredient'); return }
      const detail = await r.json()
      setLines(prev => prev.map(l => l.key === lineKey ? {
        ...l,
        ingredientId: detail.id,
        ingredientName: detail.name,
        ingredientVerification: detail.verification,
        densityGPerMl: numOrNull(detail.densityGPerMl),
        moisturePct: numOrNull(detail.moisturePct),
        nutrients: (detail.nutrients ?? []).map((n: {
          nutrientId: string
          amountPer100g: string
          nutrient: { id: string; name: string; unit: string; category: string }
        }) => ({
          nutrientId: n.nutrientId,
          amountPer100g: parseFloat(n.amountPer100g),
          name: n.nutrient.name,
          unit: n.nutrient.unit,
          category: n.nutrient.category,
        })),
      } : l))
      markDirty()
    } catch {
      toast.error('Could not load ingredient')
    }
  }

  function reorderLines(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    setLines(prev => {
      const arr = [...prev]
      const fi = arr.findIndex(l => l.key === fromKey)
      const ti = arr.findIndex(l => l.key === toKey)
      if (fi === -1 || ti === -1) return prev
      const [moved] = arr.splice(fi, 1)
      arr.splice(ti, 0, moved)
      return arr.map((l, i) => ({ ...l, position: i + 1 }))
    })
    markDirty()
  }

  function sortLines(by: 'weight' | 'pct') {
    // pct is always proportional to weight; both sorts produce the same order
    void by
    setLines(prev =>
      [...prev]
        .sort((a, b) => b.weightG - a.weightG)
        .map((l, i) => ({ ...l, position: i + 1 }))
    )
    markDirty()
  }

  function getNutrientContrib(line: LineState, nutrientId: string): number {
    const n = line.nutrients.find(n => n.nutrientId === nutrientId)
    if (!n || line.weightG <= 0) return 0
    return n.amountPer100g * (line.weightG / 100)
  }

  function getCalcNutrient(nutrientId: string) {
    return calcResult?.results.find(r => r.nutrientId === nutrientId)
  }

  if (isLoading) return <div className="px-8 py-8 text-sm text-gray-400">Loading…</div>
  if (error || !data) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-500">Formulation not found.</p>
        <button onClick={() => router.back()} className="mt-2 text-sm text-blue-600 hover:underline">← Back</button>
      </div>
    )
  }

  // View-only team members get the same read-only grid as a finalized formulation
  const readOnly = data.canEdit === false
  const isLocked = data.status === 'locked' || readOnly
  const isIterationArchived = !!data.iterationArchivedAt
  const liveIterations = data.iterations.filter(it => !it.iterationArchivedAt)
  const archivedIterations = data.iterations.filter(it => !!it.iterationArchivedAt)
  // Archiving one iteration needs another live one to remain
  const canArchiveIteration = !isIterationArchived && liveIterations.some(it => it.id !== data.id)
  // Why the grid's controls are disabled, for their hints
  const lockedReason = readOnly
    ? 'View only: you can’t change this formulation'
    : 'Finalized. Unlock it, or make a new iteration, to change it.'
  const pctRemaining = totalWeightG > 0
    ? 100 - lines.reduce((s, l) => s + (l.weightG / totalWeightG) * 100, 0)
    : 100

  return (
    <div className="px-3 py-4 sm:px-8 sm:py-6 max-w-7xl">
      {/* Back nav */}
      <button
        onClick={() => { if (confirmLeave()) router.push(`/projects/${data.projectId}`) }}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 print:hidden"
      >
        <ArrowLeft size={14} /> {data.project?.name ?? 'Project'}
      </button>

      {/* Company logo when the page itself is printed (the print view has its own) */}
      <CompanyLogo className="hidden print:block max-h-14 max-w-[220px] mb-4" />

      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <form
              className="flex items-center gap-2 mb-1"
              onSubmit={e => {
                e.preventDefault()
                const v = nameEdit.trim()
                if (v) renameMutation.mutate(v)
              }}
            >
              <input
                autoFocus
                value={nameEdit}
                onChange={e => setNameEdit(e.target.value)}
                className="text-xl font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent flex-1"
              />
              <button type="submit" disabled={!nameEdit.trim() || renameMutation.isPending}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0">
                <Save size={12} /> Save
              </button>
              <button type="button" onClick={() => setEditingName(false)}
                aria-label="Cancel renaming" data-tip="Cancel renaming"
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded shrink-0">
                <X size={14} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 group/name mb-0.5">
              <h1 className="text-xl font-semibold text-gray-900 truncate min-w-0" data-tip={data.name}>{data.name}</h1>
              {isLocked && (
                <span
                  className="shrink-0"
                  role="img"
                  aria-label={readOnly ? 'View only' : 'Locked'}
                  data-tip={readOnly ? 'View only: you can’t change this formulation' : GLOSSARY.lockedStatus}
                >
                  <Lock size={13} className="text-gray-400" />
                </span>
              )}
              {!isLocked && (
                <button
                  onClick={() => { setNameEdit(data.name); setEditingName(true) }}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700 rounded shrink-0"
                  aria-label="Rename formulation"
                  data-tip="Rename this formulation. The new name applies to every version."
                >
                  <Edit2 size={13} />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            {data.iterations.length > 1 ? (
              <select
                value={data.id}
                onChange={e => {
                  if (e.target.value === data.id) return
                  if (!confirmLeave()) { e.target.value = data.id; return }
                  router.push(`/formulations/${e.target.value}`)
                }}
                aria-label="Version"
                data-tip="Opens another version of this formulation. Finalized versions show a padlock."
                className="text-sm text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
              >
                {liveIterations.map(it => (
                  <option key={it.id} value={it.id}>
                    v{it.version}{iterationLabel(it.iterationNote)}{it.status === 'locked' ? ' 🔒' : ''}{it.id === liveIterations[0]?.id ? ' (latest)' : ''}
                  </option>
                ))}
                {archivedIterations.length > 0 && (
                  <optgroup label="Archived">
                    {archivedIterations.map(it => (
                      <option key={it.id} value={it.id}>
                        v{it.version}{iterationLabel(it.iterationNote)}{it.status === 'locked' ? ' 🔒' : ''} (archived)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <span className="text-sm text-gray-400"><Term t="version">v{data.version}</Term></span>
            )}
            {data.iterations.length > 1 && allNutrients && (
              <button
                onClick={() => setShowCompare(true)}
                data-tip="Shows two saved versions side by side: weights, %, and nutrition per 100 g"
                className="text-sm text-blue-600 hover:underline print:hidden"
              >
                Compare
              </button>
            )}
            {readOnly
              ? data.iterationNote && <span className="text-sm text-gray-600">{data.iterationNote}</span>
              : <IterationNote formulationId={id} note={data.iterationNote} />}
            <span className="capitalize">
              {data.mode === 'ground_up' ? <Term t="groundUp">Ground up</Term> : <Term t="reverse">Reverse</Term>}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-medium ${
              isLocked ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <Term t={data.status === 'locked' ? 'lockedStatus' : 'draftStatus'}>{data.status}</Term>
            </span>
            {readOnly && (
              <span className="px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-700">
                <Term t="viewOnly">view only</Term>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {isDirty && !isLocked && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-tip="Saves the ingredients, amounts, order, locks, Solve limits, batch and serving size"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm
                         rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={13} />
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
          {data.mode === 'reverse' && !readOnly && (
            <button
              onClick={() => setShowReverseWizard(true)}
              data-tip={hasReverseDraft
                ? 'Opens the reverse-engineer wizard, where you can resume your saved draft'
                : 'Opens the wizard that works out a recipe matching an existing product label'}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-600
                         text-sm rounded-md hover:bg-violet-50 transition-colors"
            >
              <Zap size={13} /> Reverse wizard
              {hasReverseDraft && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700">draft</span>
              )}
            </button>
          )}
          {(data.project?.targets?.length ?? 0) > 0 && lines.length > 0 && !readOnly && (
            <button
              onClick={() => {
                // The solver reads the saved formula, so unsaved edits would be ignored
                if (isDirty) { toast.warning('Save your changes first — Solve works from the last saved version'); return }
                solveMutation.mutate()
              }}
              disabled={solveMutation.isPending}
              data-tip={`${GLOSSARY.solve} Locked ingredients stay fixed. Works from the last saved version.`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white
                         text-sm rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Zap size={13} />
              {solveMutation.isPending ? 'Solving…' : 'Solve'}
            </button>
          )}
          {(data.project?.targets?.length ?? 0) > 0 && lines.length > 0 && !readOnly && (() => {
            const limited = lines.filter(l => l.minPct != null || l.maxPct != null).length
            return (
              <button
                onClick={() => setShowSolverBounds(true)}
                data-tip={`Set the minimum and maximum usage % Solve may give each ingredient${limited > 0 ? ` (${limited} ingredient${limited === 1 ? ' has' : 's have'} limits)` : ''}`}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-600
                           text-sm rounded-md hover:bg-violet-50 transition-colors"
              >
                Limits
                {limited > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700">{limited}</span>
                )}
              </button>
            )
          })()}
          {!readOnly && <div className="relative">
            <button
              onClick={() => setShowDuplicateMenu(v => !v)}
              disabled={iterateMutation.isPending || forkMutation.isPending}
              aria-expanded={showDuplicateMenu}
              data-tip="Copies the last saved version, as the next version (iteration) or as a new formulation"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600
                         text-sm rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <GitBranch size={13} />
              {iterateMutation.isPending ? 'Creating…' : 'Duplicate'}
              <ChevronDown size={12} />
            </button>
            {showDuplicateMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDuplicateMenu(false)} />
                <div className="absolute right-0 z-20 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-1">
                  <button
                    onClick={() => {
                      setShowDuplicateMenu(false)
                      if (requireSavedChanges()) iterateMutation.mutate()
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-800">New iteration</div>
                    <div className="text-xs text-gray-400">
                      Saves as v{(data.iterations[0]?.version ?? data.version) + 1} of this formulation
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowDuplicateMenu(false)
                      if (!requireSavedChanges()) return
                      setNewFormulationName('')
                      setShowNewFormulation(true)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-800">New formulation</div>
                    <div className="text-xs text-gray-400">
                      Separate formulation under a new name, starting at v1
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>}
          {readOnly ? null : isLocked ? (
            <button
              onClick={() => setConfirmAction('unfinalize')}
              data-tip="Returns this version to draft so it can be edited (asks to confirm). A new iteration keeps the approved one intact."
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-600
                         text-sm rounded-md hover:bg-amber-50 transition-colors"
            >
              <Unlock size={13} /> Unlock
            </button>
          ) : (
            <button
              onClick={() => setConfirmAction('finalize')}
              data-tip="Marks this version approved and locks it against changes (asks to confirm). You can still print, duplicate and record batches."
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600
                         text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              <Lock size={13} /> Finalize
            </button>
          )}
          {data.status === 'locked' && lines.length > 0 && (
            <button
              onClick={() => setShowSaveAsIngredient(true)}
              data-tip={GLOSSARY.saveAsIngredient}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700
                         text-sm rounded-md hover:bg-blue-50 transition-colors"
            >
              <PackagePlus size={13} /> Save as ingredient
            </button>
          )}
          {calcResult && (
            <button
              onClick={() => setShowNfpDialog(true)}
              data-tip="Builds the Nutrition Facts panel (FDA rounding) from what’s on screen, to download, print or save"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 text-green-700
                         text-sm rounded-md hover:bg-green-50 transition-colors"
            >
              <FileText size={13} /> NFP
            </button>
          )}
          <button
            onClick={handlePrint}
            data-tip="Opens a print-friendly sheet of the last saved version in a new tab. You choose the sections first."
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600
                       text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            <Printer size={13} /> Print
          </button>
          {lines.length > 0 && !readOnly && (
            <button
              onClick={() => setShowCompleteBatch(true)}
              data-tip={`${GLOSSARY.completeBatch} Uses the last saved version.`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700
                         text-sm rounded-md hover:bg-emerald-50 transition-colors"
            >
              <CheckCircle2 size={13} /> Complete batch
            </button>
          )}
          {!readOnly && (canArchiveIteration ? (
            <div className="relative">
              <button
                onClick={() => setShowArchiveMenu(v => !v)}
                aria-haspopup="menu"
                aria-expanded={showArchiveMenu}
                data-tip="Archive just this version, or the whole formulation"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500
                           text-sm rounded-md hover:bg-gray-50 transition-colors"
              >
                <Archive size={13} /> Archive <ChevronDown size={12} />
              </button>
              {showArchiveMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowArchiveMenu(false)} />
                  <div role="menu" className="absolute right-0 z-20 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-1">
                    <button
                      role="menuitem"
                      onClick={() => { setShowArchiveMenu(false); setConfirmAction('archive-iteration') }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="text-sm font-medium text-gray-800">Archive v{data.version} only</div>
                      <div className="text-xs text-gray-400">The other iterations stay live</div>
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setShowArchiveMenu(false); setConfirmAction('archive') }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="text-sm font-medium text-gray-800">Archive whole formulation</div>
                      <div className="text-xs text-gray-400">Hides every iteration from the project</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setConfirmAction('archive')}
              data-tip="Hides every version of this formulation from the project (asks to confirm). Restore it from the project’s Archived list."
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500
                         text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              <Archive size={13} /> Archive
            </button>
          ))}
        </div>
      </div>

      {isIterationArchived && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-4 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 print:hidden">
          <span className="flex items-center gap-2">
            <Archive size={14} className="shrink-0" />
            v{data.version} is archived. The project page skips it; the other iterations are unaffected.
          </span>
          {!readOnly && (
            <button
              onClick={() => iterationArchiveMutation.mutate(false)}
              disabled={iterationArchiveMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-1 text-xs border border-amber-300 rounded-md bg-white hover:bg-amber-100 disabled:opacity-50"
            >
              <RotateCcw size={11} /> {iterationArchiveMutation.isPending ? 'Restoring…' : 'Restore iteration'}
            </button>
          )}
        </div>
      )}

      {/* Settings bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100 text-sm print:hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500"><Term t="batchSize">Batch (g)</Term></span>
          <WeightInput
            value={batchLocked && batchTargetG != null ? batchTargetG : totalWeightG}
            onChange={commitBatchSize}
            commitOn="blur"
            disabled={isLocked}
            ariaLabel="Batch size (g)"
            tip={isLocked ? undefined : batchLocked
              ? 'Locked batch size: unlocked ingredients rebalance so the total stays at this. Type a new size and press Enter to change it.'
              : 'Type a batch size and press Enter to scale the whole recipe to it, keeping the same proportions'}
            className="w-28 px-2 py-0.5 text-right text-sm border border-gray-200 rounded focus:outline-none
                       focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:bg-gray-50 tabular-nums"
          />
          <LockToggle
            active={batchLocked}
            disabled={isLocked}
            onClick={toggleBatchLock}
            lockedTitle="Batch size locked: changing one ingredient makes the unlocked ones grow or shrink to keep this total. Click to unlock."
            unlockedTitle="Lock the batch size, so the total stays fixed while you change ingredients"
            disabledTip={lockedReason}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500"><Term t="servingSize">Serving (g)</Term></span>
          <input
            type="number"
            aria-label="Serving size (g)"
            min="0"
            step="any"
            value={servingSizeG}
            onChange={e => { setServingSizeG(e.target.value); markDirty() }}
            disabled={isLocked}
            placeholder="—"
            className="w-20 px-2 py-0.5 text-sm border border-gray-200 rounded focus:outline-none
                       focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500"><Term t="yield">Yield</Term></span>
          <span
            className="font-medium text-gray-700"
            data-tip={calcResult
              ? `Production loss ${calcResult.processYield.productionLossG.toFixed(1)} g · moisture loss ${calcResult.processYield.moistureLossG.toFixed(1)} g. Set losses on each process step.`
              : 'Set losses on each process step'}
          >
            {calcResult && calcResult.totalWeightG > 0
              ? `${calcResult.processYield.yieldPct.toFixed(1)}% · ${calcResult.finishedWeightG.toFixed(1)} g`
              : '—'}
          </span>
        </div>
      </div>

      {lockProblem && (
        <div role="alert" className="mb-4 px-3 py-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
          {lockProblem}
        </div>
      )}

      {prefs.showCogs && (
        <div className="flex border-b border-gray-200 mb-4 print:hidden" role="tablist" aria-label="Formulation views">
          {([['formula', 'Formula'], ['cogs', 'COGS']] as const).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => setTab(t)}
              data-tip={t === 'cogs' ? GLOSSARY.cogs : 'The recipe: ingredients, amounts, nutrition and process steps'}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                activeTab === t ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'cogs' && (
        <CogsPanel
          key={data.unitSizeG ?? 'none'}
          formulationId={id}
          lines={lines}
          finishedWeightG={calcResult?.finishedWeightG ?? totalWeightG}
          yieldPct={calcResult?.processYield.yieldPct ?? 100}
          servingSizeG={servingSizeG && parseFloat(servingSizeG) > 0 ? parseFloat(servingSizeG) : null}
          unitSizeG={data.unitSizeG ? parseFloat(data.unitSizeG) : null}
          canEdit={!readOnly}
          hasUnsavedChanges={isDirty}
        />
      )}

      {activeTab === 'formula' && (<>
      {/* Sort + column controls */}
      {lines.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2 justify-end print:hidden">
          {lines.length > 1 && !isLocked && (
            <>
              <span className="text-xs text-gray-400 mr-0.5">Sort:</span>
              <button
                onClick={() => sortLines('weight')}
                data-tip="Reorders the rows heaviest first. Click Save to keep the order."
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              >
                <ArrowDownNarrowWide size={11} /> By weight
              </button>
              <button
                onClick={() => sortLines('pct')}
                data-tip="Reorders the rows by usage %, largest first (the same order as by weight). Click Save to keep it."
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              >
                <ArrowDownNarrowWide size={11} /> By %
              </button>
              <span className="mx-1 h-4 w-px bg-gray-200" />
            </>
          )}
          {allNutrients && (
            <GridColumnPicker
              allNutrients={allNutrients}
              selectedIds={gridNutrients.map(n => n.id)}
              presentIds={presentNutrientIds}
              isDefault={gridNutrientIds === null}
              onChange={ids => changeGridColumns(ids)}
              onReset={() => changeGridColumns(null)}
            />
          )}
        </div>
      )}

      {/* Grid table */}
      {/* Sized to its columns, so extra nutrient columns scroll sideways; the ingredient column stays pinned,
          and the sideways scrollbar stays at the bottom of the screen while the grid is in view */}
      <StickyXScroll className="rounded-lg border border-gray-200">
        <table className="w-max min-w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-2 py-2.5 w-6 print:hidden" />
              <th className="px-3 py-2.5 text-left font-medium w-6">#</th>
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left font-medium">Ingredient</th>
              <th className="px-3 py-2.5 text-right font-medium w-48">
                <span className="inline-flex items-center gap-1.5">
                  <Term t="weightG">Amount</Term>
                  <select
                    value={columnUnit}
                    onChange={e => changeColumnUnit(e.target.value as WeightUnit)}
                    aria-label="Unit for the amount column"
                    data-tip="Shows and types every amount in this unit. Lines given their own unit keep it. Amounts are stored in grams, so the formula doesn’t change. Volume units need each ingredient’s density; lines without one stay in grams."
                    className="px-1 py-0.5 text-xs font-normal text-gray-700 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <UnitOptions />
                  </select>
                </span>
              </th>
              <th className="px-3 py-2.5 text-right font-medium w-40">
                <span className="inline-flex items-center gap-1">
                  <Term t="usagePct">%</Term>
                  <button
                    type="button"
                    onClick={() => changePctDecimals(-1)}
                    disabled={pctDecimals <= PCT_DECIMALS_MIN}
                    aria-label="Show fewer decimal places"
                    data-tip="Show fewer decimal places in the % column"
                    className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 print:hidden"
                  >−</button>
                  <span className="text-gray-400 font-normal tabular-nums" data-tip="Decimal places shown in the % column. Remembered in this browser.">{pctDecimals} dp</span>
                  <button
                    type="button"
                    onClick={() => changePctDecimals(1)}
                    disabled={pctDecimals >= PCT_DECIMALS_MAX}
                    aria-label="Show more decimal places"
                    data-tip="Show more decimal places in the % column (up to 4)"
                    className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 print:hidden"
                  >+</button>
                </span>
              </th>
              {gridNutrients.map(n => (
                <th
                  key={n.id}
                  className="px-3 py-2.5 text-right font-medium w-24 whitespace-nowrap"
                  data-tip={`${n.name} (${n.unit}) each ingredient adds to the whole batch. The Total row shows it per 100 g finished.`}
                >
                  {GRID_HEADER_LABELS[n.name] ?? n.name}
                  <span className="text-gray-400 font-normal ml-0.5">/{n.unit}</span>
                </th>
              ))}
              <th className="px-3 py-2.5 w-8 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {lines.map((line) => {
              const linePct = totalWeightG > 0 ? (line.weightG / totalWeightG) * 100 : 0
              const lineUnit = effectiveUnit(line.weightUnit, columnUnit, line.densityGPerMl)
              // The column is in a volume unit but this ingredient has no density, so it stays in grams
              const columnFallback = !line.weightUnit && isVolumeUnit(columnUnit) && !line.densityGPerMl
              const isBeingDragged = dragKey === line.key
              const isDropTarget = dragOverKey === line.key && dragKey !== line.key
              return (
                <tr
                  key={line.key}
                  draggable={!isLocked}
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragKey(line.key) }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(line.key) }}
                  onDrop={e => { e.preventDefault(); if (dragKey) reorderLines(dragKey, line.key); setDragOverKey(null) }}
                  onDragEnd={() => { setDragKey(null); setDragOverKey(null) }}
                  className={`group transition-colors ${
                    isBeingDragged ? 'opacity-40 bg-blue-50' :
                    isDropTarget   ? 'border-t-2 border-blue-400 bg-blue-50' :
                    'bg-white hover:bg-gray-50'
                  }`}
                >
                  <td
                    className={`px-2 py-2 print:hidden ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    data-tip={!isLocked ? 'Drag onto another row to reorder' : undefined}
                  >
                    {!isLocked && (
                      <GripVertical size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{line.position}</td>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                    <button
                      onClick={() => {
                        setSidebarIngredientId(line.ingredientId)
                        setSidebarLineKey(line.key)
                      }}
                      data-tip="Opens this ingredient’s nutrients, allergens, suppliers and info in a side panel, where you can also swap it"
                      className="flex items-center gap-1.5 group/name text-left hover:text-blue-600 transition-colors min-w-44 max-w-xs"
                    >
                      <span className="font-medium text-gray-800 group-hover/name:text-blue-600 transition-colors">
                        {line.ingredientName}
                      </span>
                      {line.ingredientVerification !== 'verified' && (
                        <span className="text-xs text-yellow-500" aria-label="Unverified" data-tip={GLOSSARY.unverified}>⚠</span>
                      )}
                      {libraryById.get(line.ingredientId)?.onHand && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-label="On hand" data-tip={GLOSSARY.onHand} />
                      )}
                    </button>
                    {!isLocked && (() => {
                      const libIng = libraryById.get(line.ingredientId)
                      const inFormula = new Set(lines.map(l => l.ingredientId))
                      const alts = libIng ? onHandAlternatives(libIng, library.filter(i => !inFormula.has(i.id)), 3) : []
                      if (!libIng || alts.length === 0) return null
                      return (
                        <button
                          onClick={() => { setSwapTargetKey(line.key); setShowLibraryPicker(true) }}
                          className="mt-0.5 block text-left text-[11px] text-emerald-700 hover:underline print:hidden max-w-xs truncate"
                          data-tip={`Not on hand. On-hand ${libIng.category} you could use instead: ${alts.map(a => a.name).join(', ')}. Click to swap one in.`}
                        >
                          On hand instead: {alts.map(a => a.name).join(', ')}
                        </button>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <WeightInput
                        value={line.weightG}
                        onChange={g => updateWeight(line.key, String(g))}
                        disabled={isLocked || line.locked || line.pctLocked}
                        tip={line.pctLocked ? 'Set by the locked usage %. Unlock the % to edit.' : undefined}
                        unit={lineUnit}
                        densityGPerMl={line.densityGPerMl}
                        ariaLabel={`Amount of ${line.ingredientName} (${UNIT_LABELS[lineUnit]})`}
                      />
                      <select
                        value={line.weightUnit ?? ''}
                        onChange={e => changeLineUnit(line.key, (e.target.value || null) as WeightUnit | null)}
                        disabled={isLocked}
                        aria-label={`Unit for ${line.ingredientName}`}
                        data-tip={line.weightUnit
                          ? `This ingredient is shown in ${UNIT_LABELS[line.weightUnit]}, whatever the column’s unit. Choose the first option to follow the column again.`
                          : columnFallback
                            ? `Shown in grams: ${UNIT_LABELS[columnUnit]} needs this ingredient’s density. Choose a volume unit here to add it.`
                            : 'Follows the column’s unit. Choose another unit for just this ingredient.'}
                        className={`w-14 px-0.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 ${
                          line.weightUnit ? 'text-blue-700 font-medium' : columnFallback ? 'text-amber-600' : 'text-gray-500'
                        }`}
                      >
                        <option value="">{UNIT_LABELS[effectiveUnit(null, columnUnit, line.densityGPerMl)]}</option>
                        <UnitOptions needsDensity={!line.densityGPerMl} />
                      </select>
                      <LockToggle
                        active={line.locked}
                        disabled={isLocked}
                        onClick={() => toggleQtyLock(line.key)}
                        lockedTitle="Weight locked: this ingredient keeps exactly these grams. Click to unlock."
                        unlockedTitle="Lock the weight, so this ingredient keeps the same grams whatever else changes"
                        disabledTip={lockedReason}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                      <PctInput
                        value={line.pctLocked && line.lockedPct != null ? line.lockedPct : linePct}
                        decimals={pctDecimals}
                        onChange={p => updatePct(line.key, p)}
                        disabled={isLocked || line.locked}
                        tip={line.locked ? 'Set by the locked weight. Unlock the weight to edit.' : undefined}
                      />
                      <LockToggle
                        active={line.pctLocked}
                        disabled={isLocked}
                        onClick={() => togglePctLock(line.key)}
                        lockedTitle="Usage % locked: this ingredient always stays this share of the batch. Click to unlock."
                        unlockedTitle="Lock the usage %, so this ingredient always stays the same share of the batch"
                        disabledTip={lockedReason}
                      />
                    </div>
                  </td>
                  {gridNutrients.map(n => {
                    const contrib = getNutrientContrib(line, n.id)
                    return (
                      <td key={n.id} className="px-3 py-2 text-right tabular-nums text-gray-600">
                        {contrib > 0 ? formatAmt(contrib, n.unit) : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 print:hidden">
                    {!isLocked && (
                      <button
                        onClick={() => removeLine(line.key)}
                        aria-label={`Remove ${line.ingredientName}`}
                        data-tip="Removes this ingredient from the formula. Click Save to keep the change."
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}

            {/* Total row */}
            {lines.length > 0 && (
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-medium text-xs text-gray-600">
                <td className="px-2 py-2" />
                <td className="px-3 py-2" />
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                  <Term tip="The total batch weight. For nutrients this row shows the amount per 100 g finished, not the sum of the column.">Total</Term>
                  {' '}({lines.length} ingredient{lines.length !== 1 ? 's' : ''})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatGramsIn(totalWeightG, columnUnit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className={Math.abs(100 - (totalWeightG > 0 ? 100 : 0)) < 0.01 ? 'text-green-600' : 'text-gray-500'}>
                    {totalWeightG > 0 ? `${(100).toFixed(pctDecimals)}%` : '—'}
                  </span>
                </td>
                {gridNutrients.map(n => {
                  const r = getCalcNutrient(n.id)
                  return (
                    <td key={n.id} className="px-3 py-2 text-right tabular-nums text-gray-500">
                      {r ? formatAmt(r.perFinished100g, n.unit) : '—'}
                    </td>
                  )
                })}
                <td />
              </tr>
            )}

            {/* Per 100g finished row */}
            {calcResult && calcResult.finishedWeightG > 0 && (
              <tr className="bg-blue-50 text-xs font-semibold text-blue-700">
                <td className="px-2 py-2" />
                <td className="px-3 py-2" />
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2"><Term t="per100gFinished">Per 100 g finished</Term></td>
                <td className="px-3 py-2 text-right tabular-nums">—</td>
                <td className="px-3 py-2 text-right">—</td>
                {gridNutrients.map(n => {
                  const r = getCalcNutrient(n.id)
                  return (
                    <td key={n.id} className="px-3 py-2 text-right tabular-nums">
                      {r ? formatAmt(r.perFinished100g, n.unit) : '—'}
                    </td>
                  )
                })}
                <td />
              </tr>
            )}

            {/* Per serving row */}
            {calcResult && servingSizeG && parseFloat(servingSizeG) > 0 && (
              <tr className="bg-emerald-50 text-xs font-semibold text-emerald-700">
                <td className="px-2 py-2" />
                <td className="px-3 py-2" />
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2"><Term t="perServing">Per serving</Term> ({servingSizeG} g)</td>
                <td className="px-3 py-2 text-right tabular-nums">—</td>
                <td className="px-3 py-2 text-right">—</td>
                {gridNutrients.map(n => {
                  const r = getCalcNutrient(n.id)
                  return (
                    <td key={n.id} className="px-3 py-2 text-right tabular-nums">
                      {r?.perServing != null ? formatAmt(r.perServing, n.unit) : '—'}
                    </td>
                  )
                })}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </StickyXScroll>

      {/* Add ingredient row */}
      {!isLocked && (
        <div className="mt-3 print:hidden">
          {showAddRow ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <IngredientSearchDropdown
                onSelect={addIngredient}
                onClose={() => setShowAddRow(false)}
                onAddManually={(q) => { setManualInitialName(q); setShowManualDialog(true) }}
                onImportUsda={(q) => { setUsdaInitialQuery(q); setShowUsdaDialog(true) }}
              />
              <button
                onClick={() => setShowAddRow(false)}
                aria-label="Close search"
                data-tip="Close the ingredient search"
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRow(true)}
              data-tip="Search your ingredient library, or add a new one by hand or from USDA"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600
                         hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Plus size={14} /> Add ingredient
            </button>
          )}
        </div>
      )}

      {/* Process steps */}
      <div className="mt-6">
        <ProcessStepsPanel
          formulationId={id}
          steps={data.processSteps ?? []}
          isLocked={isLocked}
          canEditLibrary={data.canEditLibrary ?? false}
        />
      </div>

      <div className="mt-6">
        <BatchHistoryPanel formulationId={id} />
      </div>

      {/* Full nutrient profile toggle */}
      {calcResult && calcResult.results.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              onClick={() => setShowProfile(p => !p)}
              aria-expanded={showProfile}
              data-tip={showProfile ? 'Hides the full nutrient profile' : 'Shows every nutrient per 100 g finished and per serving, and which ingredients it comes from'}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showProfile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Full nutrient profile
              <span className="text-xs text-gray-400 font-normal ml-1">
                ({calcResult.results.length} nutrients)
              </span>
            </button>
            {showProfile && (
              <>
                <span className="text-xs text-gray-400">Click a nutrient to see each ingredient&apos;s contribution</span>
                <button
                  onClick={() => setExpandedNutrients(prev =>
                    prev.size > 0 ? new Set() : new Set(calcResult.results.map(r => r.nutrientId)))}
                  className="text-xs text-blue-600 hover:underline print:hidden"
                >
                  {expandedNutrients.size > 0 ? 'Collapse all' : 'Expand all'}
                </button>
              </>
            )}
          </div>

          {showProfile && (
            <div className="mt-3 space-y-4">
              {CATEGORY_ORDER.map(cat => {
                const rows = calcResult.results.filter(r => r.category === cat)
                if (rows.length === 0) return null
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Nutrient</th>
                            <th className="px-4 py-2 text-right font-medium"><Term t="per100gFinished">Per 100 g</Term></th>
                            {servingSizeG && parseFloat(servingSizeG) > 0 && (
                              <th className="px-4 py-2 text-right font-medium"><Term t="perServing">Per serving</Term></th>
                            )}
                            <th className="px-4 py-2 text-right font-medium text-gray-400">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {rows.map(r => {
                            const isOpen = expandedNutrients.has(r.nutrientId)
                            const serving = servingSizeG ? parseFloat(servingSizeG) : 0
                            return (
                              <Fragment key={r.nutrientId}>
                                <tr
                                  onClick={() => toggleNutrientExpanded(r.nutrientId)}
                                  className={`cursor-pointer ${isOpen ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                  aria-expanded={isOpen}
                                >
                                  <td className="px-4 py-1.5 text-gray-800">
                                    <span className="inline-flex items-center gap-1">
                                      {isOpen
                                        ? <ChevronDown size={12} className="text-gray-400" />
                                        : <ChevronRight size={12} className="text-gray-300" />}
                                      {r.name}
                                    </span>
                                  </td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">
                                    {formatAmt(r.perFinished100g, r.unit)}
                                  </td>
                                  {serving > 0 && (
                                    <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">
                                      {r.perServing != null ? formatAmt(r.perServing, r.unit) : '—'}
                                    </td>
                                  )}
                                  <td className="px-4 py-1.5 text-right text-gray-400">{r.unit}</td>
                                </tr>
                                {isOpen && (
                                  <tr className="bg-gray-50/60">
                                    <td colSpan={serving > 0 ? 4 : 3} className="px-4 pb-2.5 pt-1">
                                      <NutrientContributionList
                                        contributions={calcNutrientContributions(lines, r.nutrientId, calcResult.concentrationWeightG)}
                                        unit={r.unit}
                                        servingSizeG={serving > 0 ? serving : null}
                                        totalLines={lines.length}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Validation matrix */}
      {(() => {
        const projectTargets = (data.project?.targets ?? []) as ProjectTarget[]
        if (!calcResult || projectTargets.length === 0) return null
        const serving = servingSizeG ? parseFloat(servingSizeG) : undefined
        const validations = evaluateTargets(projectTargets, calcResult.results, serving, dryBasisFactor(calcResult))
        const noMoisture = calcResult.missingMoistureIds
          .map(iid => lines.find(l => l.ingredientId === iid)?.ingredientName)
          .filter(Boolean)
          .join(', ')
        const passes = validations.filter(v => v.status === 'pass').length
        const fails  = validations.filter(v => v.status === 'fail').length
        const warns  = validations.filter(v => v.status === 'warn').length
        return (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700"><Term t="validation">Validation</Term></span>
              <span className="text-xs text-gray-400">vs. project <Term t="target">targets</Term></span>
              <span className="ml-auto flex items-center gap-2 text-xs">
                {passes > 0 && <span className="text-green-600">{passes} <Term t="pass">pass</Term></span>}
                {warns > 0  && <span className="text-yellow-600">{warns} <Term t="warn">warn</Term></span>}
                {fails > 0  && <span className="text-red-600">{fails} <Term t="fail">fail</Term></span>}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nutrient</th>
                    <th className="px-4 py-2 text-left font-medium">Requirement</th>
                    <th className="px-4 py-2 text-right font-medium">
                      <Term tip="This formulation’s value, from what’s on screen (including unsaved changes).">Actual</Term>
                    </th>
                    <th className="px-4 py-2 text-center font-medium w-16">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {validations.map(({ t, status, actual }, i) => (
                    <tr key={i} className={
                      status === 'fail' ? 'bg-red-50' :
                      status === 'warn' ? 'bg-yellow-50' : ''
                    }>
                      <td className="px-4 py-2 font-medium text-gray-800">{t.label || t.nutrient}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {fmtRequirement(t)}
                        {' '}
                        <span className="text-gray-400">{fmtBasis(t)}</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                        {actual != null
                          ? withUnit(formatAmt(actual, t.unit), t.unit, t.nutrient)
                          : t.dryBasis && noMoisture
                            ? <span className="text-amber-600 text-xs" data-tip={`Dry basis needs every ingredient’s moisture %. Click an ingredient’s name in the formula to add it: ${noMoisture}.`}>
                                add moisture %
                              </span>
                            : <span className="text-gray-300 text-xs">
                                {t.basis === 'per_serving' && !serving ? 'set serving size' : '—'}
                              </span>
                        }
                      </td>
                      <td className="px-4 py-2 flex justify-center">
                        <span data-tip={STATUS_TIP[status]} aria-label={status}>{statusIcon(status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Solver panel */}
      {showSolverPanel && solverResult && (
        <div className="mt-6 border border-violet-200 rounded-lg overflow-hidden">
          {/* Panel header */}
          <div className="bg-violet-50 px-4 py-3 flex items-center gap-2">
            <Zap size={14} className="text-violet-500" />
            <span className="text-sm font-medium text-violet-700"><Term t="solve">LP Solver</Term></span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              solverResult.status === 'optimal'    ? 'bg-green-100 text-green-700' :
              solverResult.status === 'infeasible' ? 'bg-red-100 text-red-700' :
                                                     'bg-gray-100 text-gray-600'
            }`}
              data-tip={solverResult.status === 'optimal'
                ? 'Optimal: found amounts that meet the targets with the smallest change to your recipe'
                : solverResult.status === 'infeasible'
                  ? 'Infeasible: no mix of these ingredients meets every target within your limits'
                  : undefined}
            >
              {solverResult.status}
            </span>
            {solverResult.status === 'optimal' && (
              <span className="text-xs text-gray-400">{solverResult.solveTimeMs}ms</span>
            )}
            <button
              onClick={() => setShowSolverPanel(false)}
              aria-label="Close solver results"
              data-tip="Close the solver results without applying them"
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>

          {/* Infeasible / error message, or a note on an optimal result (e.g. skipped targets) */}
          {solverResult.message && (
            <div className={`px-4 py-3 text-sm border-b border-violet-100 ${
              solverResult.status === 'optimal' ? 'text-amber-800 bg-amber-50' : 'text-red-600 bg-red-50'
            }`}>
              {solverResult.message}
            </div>
          )}

          {/* Suggested weights */}
          {solverResult.status === 'optimal' && (
            <div className="px-4 py-3 border-b border-violet-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Suggested Weights
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th className="text-left font-medium pb-1.5">Ingredient</th>
                      <th className="text-right font-medium pb-1.5 pr-2">Current %</th>
                      <th className="text-right font-medium pb-1.5 pr-2">
                        <Term tip="The usage % Solve suggests for this ingredient.">Suggested %</Term>
                      </th>
                      <th className="text-right font-medium pb-1.5 pr-2">
                        <Term tip="The weight at the suggested %, keeping the same batch total.">New weight (g)</Term>
                      </th>
                      <th className="text-right font-medium pb-1.5">
                        <Term tip="The change in usage %, in percentage points.">Δ</Term>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lines.map(l => {
                      const curPct = totalWeightG > 0 ? (l.weightG / totalWeightG) * 100 : 0
                      const sugPct = solverResult.suggestedPcts[l.ingredientId] ?? curPct
                      const delta = sugPct - curPct
                      const newW = Math.round(((sugPct / 100) * totalWeightG) * 10) / 10
                      return (
                        <tr key={l.key} className={l.locked ? 'opacity-50' : ''}>
                          <td className="py-1.5 text-gray-800">
                            {l.ingredientName}
                            {l.locked && <span className="ml-1 text-xs text-gray-400" data-tip="Weight-locked, so Solve keeps its amount">(locked)</span>}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-gray-500 pr-2">
                            {curPct.toFixed(1)}%
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900 pr-2">
                            {sugPct.toFixed(1)}%
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">
                            {newW.toFixed(1)} g
                          </td>
                          <td className={`py-1.5 text-right tabular-nums text-xs ${
                            Math.abs(delta) < 0.05 ? 'text-gray-300' :
                            delta > 0 ? 'text-green-600' : 'text-red-500'
                          }`}>
                            {Math.abs(delta) < 0.05
                              ? '—'
                              : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit trace */}
          {solverResult.auditTrace.length > 0 && (
            <div className="px-4 py-3 border-b border-violet-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <Term tip="Each project target checked against the suggested recipe.">Constraint Audit</Term>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th className="text-left font-medium pb-1.5">Target</th>
                      <th className="text-left font-medium pb-1.5">Requirement</th>
                      <th className="text-right font-medium pb-1.5 pr-2">
                        <Term tip="The value the suggested recipe reaches.">Achieved</Term>
                      </th>
                      <th className="text-right font-medium pb-1.5 pr-2">
                        <Term tip="Room to spare against the target. Positive = headroom, negative = shortfall.">Slack</Term>
                      </th>
                      <th className="text-center font-medium pb-1.5 w-14">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {solverResult.auditTrace.map((entry, i) => (
                      <tr key={i} className={
                        entry.status === 'violated' ? 'bg-red-50' :
                        entry.status === 'binding'  ? 'bg-yellow-50/60' : ''
                      }>
                        <td className="py-1.5 font-medium text-gray-800">{entry.label}</td>
                        <td className="py-1.5 text-gray-500 text-xs">{entry.requirement}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700 pr-2">
                          {entry.achieved != null
                            ? `${entry.achieved.toFixed(2)} ${entry.unit}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`py-1.5 text-right tabular-nums text-xs pr-2 ${
                          entry.slack == null ? 'text-gray-300' :
                          entry.slack < 0     ? 'text-red-500' :
                          entry.slack < 0.05  ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {entry.slack != null
                            ? (entry.slack >= 0 ? `+${entry.slack.toFixed(2)}` : entry.slack.toFixed(2))
                            : '—'}
                        </td>
                        <td className="py-1.5 flex justify-center" data-tip={AUDIT_TIP[entry.status]}>
                          {entry.status === 'satisfied' && <CheckCircle2 size={13} className="text-green-500" />}
                          {entry.status === 'binding'   && <AlertCircle  size={13} className="text-yellow-500" />}
                          {entry.status === 'violated'  && <XCircle      size={13} className="text-red-500" />}
                          {entry.status === 'no-data'   && <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Apply button */}
          {solverResult.status === 'optimal' && (
            <div className="px-4 py-3 bg-violet-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Weights will be updated proportionally to maintain the same batch total.
              </p>
              <button
                onClick={() => applySolution(solverResult)}
                data-tip="Fills the suggested weights into the grid, keeping the same batch total. Click Save to keep them."
                className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-sm
                           rounded-md hover:bg-violet-700 transition-colors"
              >
                Apply solution
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {lines.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-10 text-center">
          <Trash2 size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No ingredients yet.</p>
          {!isLocked && (
            <button
              onClick={() => setShowAddRow(true)}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Add first ingredient →
            </button>
          )}
        </div>
      )}
      </>)}

      <AddIngredientDialog
        open={showManualDialog}
        initialName={manualInitialName}
        onClose={() => setShowManualDialog(false)}
        onCreated={(id) => {
          setShowManualDialog(false)
          if (id) {
            if (swapTargetKey) {
              swapLineById(swapTargetKey, id)
              setSwapTargetKey(null)
            } else {
              addIngredientById(id)
            }
          }
        }}
      />
      <UsdaSearchDialog
        open={showUsdaDialog}
        initialQuery={usdaInitialQuery}
        existingNote={swapTargetKey ? 'swapped in' : 'added to formulation'}
        onClose={() => { setShowUsdaDialog(false); setSwapTargetKey(null) }}
        onImported={(id) => {
          setShowUsdaDialog(false)
          if (id) {
            if (swapTargetKey) swapLineById(swapTargetKey, id)
            else addIngredientById(id)
          }
          setSwapTargetKey(null)
        }}
      />
      <SwapSourceDialog
        open={showSwapSourceDialog}
        ingredientName={swapIngredientName}
        onClose={() => { setShowSwapSourceDialog(false); setSwapTargetKey(null) }}
        onLibrary={() => { setShowSwapSourceDialog(false); setShowLibraryPicker(true) }}
        onUsda={() => { setShowSwapSourceDialog(false); setShowUsdaDialog(true) }}
        onManual={() => { setShowSwapSourceDialog(false); setShowManualDialog(true) }}
      />
      <LibraryPickerDialog
        open={showLibraryPicker}
        excludeId={lines.find(l => l.key === swapTargetKey)?.ingredientId ?? sidebarIngredientId}
        onClose={() => { setShowLibraryPicker(false); setSwapTargetKey(null) }}
        onSelect={(id) => {
          setShowLibraryPicker(false)
          if (swapTargetKey) swapLineById(swapTargetKey, id)
          setSwapTargetKey(null)
        }}
      />

      {sidebarIngredientId && sidebarLineKey && (
        <IngredientSidePanel
          ingredientId={sidebarIngredientId}
          lineKey={sidebarLineKey}
          formulationLocked={isLocked}
          canEditLibrary={data?.canEditLibrary ?? false}
          onNutrientsSaved={refreshLineNutrients}
          onPropertiesSaved={(ingredientId, patch) => setLines(prev => prev.map(l => (l.ingredientId === ingredientId ? {
            ...l,
            ...(patch.moisturePct !== undefined ? { moisturePct: patch.moisturePct } : {}),
            ...(patch.densityGPerMl !== undefined ? { densityGPerMl: patch.densityGPerMl } : {}),
          } : l)))}
          onClose={() => { setSidebarIngredientId(null); setSidebarLineKey(null) }}
          onSwap={(lk, name) => {
            setSidebarIngredientId(null)
            setSidebarLineKey(null)
            setSwapTargetKey(lk)
            setSwapIngredientName(name)
            setUsdaInitialQuery(name)
            setShowSwapSourceDialog(true)
          }}
        />
      )}

      {showReverseWizard && (
        <ReverseWizard
          formulationId={id}
          onApply={(newLines) => {
            setLines(newLines.map(l => ({
              ...l, pctLocked: false, lockedPct: null, minPct: null, maxPct: null,
              weightUnit: null, densityGPerMl: numOrNull(libraryById.get(l.ingredientId)?.densityGPerMl),
              moisturePct: numOrNull(libraryById.get(l.ingredientId)?.moisturePct),
            })))
            setIsDirty(true)
            setShowReverseWizard(false)
            toast.success('Formula loaded — review and save when ready')
          }}
          onClose={() => setShowReverseWizard(false)}
        />
      )}

      {showCompare && allNutrients && (
        <CompareVersionsDialog
          currentId={id}
          iterations={data.iterations}
          allNutrients={allNutrients}
          onClose={() => setShowCompare(false)}
        />
      )}

      {showSolverBounds && (
        <SolverBoundsDialog
          rows={[...lines].sort((a, b) => a.position - b.position).map(l => ({
            key: l.key,
            name: l.ingredientName,
            locked: l.locked || l.pctLocked,
            minPct: l.minPct,
            maxPct: l.maxPct,
          }))}
          readOnly={isLocked}
          onClose={() => setShowSolverBounds(false)}
          onApply={bounds => {
            setLines(prev => prev.map(l => (bounds[l.key] ? { ...l, ...bounds[l.key] } : l)))
            markDirty()
            setShowSolverBounds(false)
            toast.success('Limits set — save, then Solve')
          }}
        />
      )}

      {densityPrompt && (() => {
        const line = lines.find(l => l.key === densityPrompt.key)
        if (!line) return null
        return (
          <DensityDialog
            ingredientName={line.ingredientName}
            unit={densityPrompt.unit}
            canEditLibrary={data.canEditLibrary !== false}
            saving={saveDensity.isPending}
            onSave={density => saveDensity.mutate({ ingredientId: line.ingredientId, density })}
            onClose={() => setDensityPrompt(null)}
          />
        )
      })()}

      {showNfpDialog && calcResult && (
        <NfpDialog
          formulationId={id}
          projectName={data.project?.name ?? null}
          formName={data.name}
          version={data.version}
          clientName={data.project?.client ?? null}
          servingSizeG={servingSizeG ? parseFloat(servingSizeG) : undefined}
          finishedWeightG={calcResult.finishedWeightG}
          results={calcResult.results}
          lines={lines}
          onClose={() => setShowNfpDialog(false)}
        />
      )}

      <CompleteBatchDialog
        open={showCompleteBatch}
        formulationId={id}
        formulationName={data.name}
        onClose={() => setShowCompleteBatch(false)}
        onCompleted={() => {
          setShowCompleteBatch(false)
          queryClient.invalidateQueries({ queryKey: ['ingredients'] })
          queryClient.invalidateQueries({ queryKey: batchRunsKey(id) })
        }}
      />

      {showSaveAsIngredient && (
        <SaveAsIngredientDialog
          formulationId={id}
          formulationName={data.name}
          onClose={() => setShowSaveAsIngredient(false)}
        />
      )}

      {showPrintDialog && (
        <PrintOptionsDialog
          hasSteps={(data.processSteps?.length ?? 0) > 0}
          hasTargets={(data.project?.targets?.length ?? 0) > 0}
          hasLines={data.lines.length > 0}
          onClose={() => setShowPrintDialog(false)}
          onConfirm={handlePrintConfirm}
        />
      )}


      {showNewFormulation && (() => {
        const trimmed = newFormulationName.trim()
        const sameName = trimmed.toLowerCase() === data.name.trim().toLowerCase()
        const canCreate = trimmed.length > 0 && !sameName && !forkMutation.isPending
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <form
              className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4"
              onSubmit={e => { e.preventDefault(); if (canCreate) forkMutation.mutate(trimmed) }}
            >
              <h3 className="text-base font-semibold text-gray-900">New formulation</h3>
              <p className="text-sm text-gray-500">
                Copies &ldquo;{data.name}&rdquo; into a separate formulation that starts at v1.
                Give it a new name.
              </p>
              <div>
                <input
                  autoFocus
                  value={newFormulationName}
                  onChange={e => setNewFormulationName(e.target.value)}
                  placeholder="New formulation name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {sameName && (
                  <p className="text-xs text-red-500 mt-1">Name must be different from the current formulation.</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewFormulation(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={!canCreate}
                  data-tip={!trimmed ? 'Enter a name first' : sameName ? 'Use a different name' : 'Copies the last saved version into a new formulation at v1, in this project'}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {forkMutation.isPending ? 'Creating…' : 'Create formulation'}
                </button>
              </div>
            </form>
          </div>
        )
      })()}


      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
            {confirmAction === 'finalize' && (
              <>
                <h3 className="text-base font-semibold text-gray-900">Finalize formulation?</h3>
                <p className="text-sm text-gray-500">
                  Locking this formulation prevents accidental edits. You can still create a new iteration to keep working, or unlock it if needed.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => finalizeMutation.mutate('locked')}
                    disabled={finalizeMutation.isPending}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                  >
                    {finalizeMutation.isPending ? 'Finalizing…' : 'Finalize & lock'}
                  </button>
                </div>
              </>
            )}
            {confirmAction === 'unfinalize' && (
              <>
                <h3 className="text-base font-semibold text-gray-900">Unlock formulation?</h3>
                <p className="text-sm text-gray-500">This will return the formulation to draft status so it can be edited.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => finalizeMutation.mutate('draft')}
                    disabled={finalizeMutation.isPending}
                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {finalizeMutation.isPending ? 'Unlocking…' : 'Yes, unlock'}
                  </button>
                </div>
              </>
            )}
            {confirmAction === 'archive-iteration' && (
              <>
                <h3 className="text-base font-semibold text-gray-900">Archive v{data.version}?</h3>
                <p className="text-sm text-gray-500">
                  Only this iteration is archived; the other iterations of &ldquo;{data.name}&rdquo; stay live. You can
                  still open it from the version list and restore it.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => iterationArchiveMutation.mutate(true)}
                    disabled={iterationArchiveMutation.isPending}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {iterationArchiveMutation.isPending ? 'Archiving…' : 'Yes, archive'}
                  </button>
                </div>
              </>
            )}
            {confirmAction === 'archive' && (
              <>
                <h3 className="text-base font-semibold text-gray-900">Archive formulation?</h3>
                <p className="text-sm text-gray-500">
                  &ldquo;{data.name}&rdquo; will be hidden from the project view. You can restore it from the project&apos;s archive.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {archiveMutation.isPending ? 'Archiving…' : 'Yes, archive'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
