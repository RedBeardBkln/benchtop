'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Save, Plus, X, Trash2, ChevronDown, ChevronUp, Lock,
  Database, ArrowLeftRight, GitBranch, Target, CheckCircle2, XCircle, AlertCircle,
  GripVertical, ArrowDownNarrowWide, Zap, Archive, Unlock, Edit2, FileText, Printer, PackagePlus,
} from 'lucide-react'
import type { FormulationDetail, Nutrient, ProjectTarget } from '@/lib/types'
import { calcNutrientProfile, formatAmt } from '@/lib/formulation-calc'
import { toLossStep } from '@/lib/process-loss'
import { formatWeightG } from '@/lib/weight'
import { WeightInput } from '@/components/formulations/weight-input'
import { PctInput } from '@/components/formulations/pct-input'
import { LockToggle } from '@/components/formulations/lock-toggle'
import { resolveLines, type Anchor } from '@/lib/formula-lock'
import { PCT_DECIMALS_MIN, PCT_DECIMALS_MAX, readPctDecimals, writePctDecimals } from '@/lib/pct-display'
import { CATEGORY_ORDER, evaluateTargets, fmtRequirement, type ValidationStatus } from '@/lib/target-validation'
import { serializePrintSections, type PrintSection } from '@/lib/print-sections'
import type { SolverResult } from '@/lib/solver'
import { IngredientSidePanel } from '@/components/ingredients/ingredient-side-panel'
import { ProcessStepsPanel } from '@/components/formulations/process-steps-panel'
import { IterationNote } from '@/components/formulations/iteration-note'
import { readErrorMessage } from '@/lib/utils'

function statusIcon(s: ValidationStatus) {
  if (s === 'pass') return <CheckCircle2 size={14} className="text-green-500" />
  if (s === 'fail') return <XCircle size={14} className="text-red-500" />
  if (s === 'warn') return <AlertCircle size={14} className="text-yellow-500" />
  return <span className="text-gray-300 text-xs">—</span>
}

import { AddIngredientDialog } from '@/components/ingredients/add-ingredient-dialog'
import { UsdaSearchDialog } from '@/components/ingredients/usda-search-dialog'
import { SwapSourceDialog, LibraryPickerDialog } from '@/components/formulations/swap-source-dialog'
import { ReverseWizard } from '@/components/formulations/reverse-wizard'
import { NfpDialog } from '@/components/formulations/nfp-dialog'
import { CompleteBatchDialog } from '@/components/formulations/complete-batch-dialog'
import { SaveAsIngredientDialog } from '@/components/formulations/save-as-ingredient-dialog'
import { PrintOptionsDialog } from '@/components/formulations/print-options-dialog'

// Key nutrients to display as columns in the grid
const GRID_NUTRIENT_NAMES = ['Energy', 'Protein', 'Total Fat', 'Total Carbohydrate', 'Dietary Fiber']

type LineState = {
  key: string           // stable React key (uuid or temp)
  ingredientId: string
  ingredientName: string
  ingredientVerification: string
  position: number
  weightG: number
  locked: boolean          // quantity lock: keeps its grams
  pctLocked: boolean       // %-lock: always `lockedPct` % of the batch
  lockedPct: number | null
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
  const [results, setResults] = useState<Array<{ id: string; name: string; verification: string }>>([])
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
              <span className="font-medium text-gray-800">{ing.name}</span>
              {ing.verification === 'verified' && (
                <span className="text-xs text-green-600">✓</span>
              )}
            </button>
          ))}
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">No ingredients found</div>
          )}
          <div className="border-t border-gray-100 bg-gray-50">
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onClose(); onAddManually(query) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-2"
            >
              <Plus size={13} className="text-blue-500 shrink-0" />
              Add manually
            </button>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onClose(); onImportUsda(query) }}
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
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualInitialName, setManualInitialName] = useState('')
  const [showUsdaDialog, setShowUsdaDialog] = useState(false)
  const [usdaInitialQuery, setUsdaInitialQuery] = useState('')
  const [swapTargetKey, setSwapTargetKey] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null)
  const [showSolverPanel, setShowSolverPanel] = useState(false)
  const [showReverseWizard, setShowReverseWizard] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'unfinalize' | 'archive' | null>(null)
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

  const { data, isLoading, error } = useQuery<FormulationDetail>({
    queryKey: ['formulation', id],
    queryFn: () =>
      fetch(`/api/formulations/${id}`).then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
  })

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
        locked: l.locked,
        pctLocked: l.pctLocked,
        lockedPct: l.pctLocked ? parseFloat(l.pct) : null,
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
    setBatchTargetG(data.batchLocked && data.batchSizeG ? parseFloat(data.batchSizeG) : null)
    // Auto-launch wizard for new reverse-mode formulations with no lines yet
    if (data.mode === 'reverse' && data.lines.length === 0) {
      setShowReverseWizard(true)
    }
  }, [data])

  // Derived values
  const totalWeightG = useMemo(() => lines.reduce((s, l) => s + (l.weightG || 0), 0), [lines])

  // Why the current locks can't all be honoured (null when they can, or when nothing is locked)
  const lockProblem = useMemo(() => {
    if (!batchLocked && !lines.some(l => l.pctLocked)) return null
    return resolveLines({ lines, batchLocked, batchG: batchTargetG }).problem
  }, [lines, batchLocked, batchTargetG])

  // Saved process steps drive yield: each step's loss shifts the finished weight and/or profile
  const processSteps = useMemo(() => data?.processSteps ?? [], [data?.processSteps])

  const calcResult = useMemo(() => {
    if (!allNutrients || lines.length === 0) return null
    return calcNutrientProfile({
      lines: lines.map(l => ({ ingredientId: l.ingredientId, weightG: l.weightG, nutrients: l.nutrients })),
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
    return GRID_NUTRIENT_NAMES
      .map(name => allNutrients.find(n => n.name === name))
      .filter(Boolean) as Nutrient[]
  }, [allNutrients])

  // New iteration: next version of this same formulation
  const iterateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/formulations/${id}/iterate`, { method: 'POST' }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Could not create iteration')
        return body
      }),
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
    mutationFn: (name: string) =>
      fetch(`/api/formulations/${id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error ?? 'Could not create formulation')
        return body
      }),
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
      const sugPct = result.suggestedPcts[l.key]
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
            lockedPct: l.pctLocked ? l.lockedPct : null,
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
      locked: false,
      pctLocked: false,
      lockedPct: null,
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
    try {
      const r = await fetch(`/api/ingredients/${id}`)
      if (!r.ok) { toast.error('Could not load ingredient'); return }
      const detail = await r.json()
      setLines(prev => prev.map(l => l.key === lineKey ? {
        ...l,
        ingredientId: detail.id,
        ingredientName: detail.name,
        ingredientVerification: detail.verification,
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

  const isLocked = data.status === 'locked'
  const pctRemaining = totalWeightG > 0
    ? 100 - lines.reduce((s, l) => s + (l.weightG / totalWeightG) * 100, 0)
    : 100

  return (
    <div className="px-3 py-4 sm:px-8 sm:py-6 max-w-7xl">
      {/* Back nav */}
      <button
        onClick={() => router.push(`/projects/${data.projectId}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 print:hidden"
      >
        <ArrowLeft size={14} /> {data.project?.name ?? 'Project'}
      </button>

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
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded shrink-0">
                <X size={14} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 group/name mb-0.5">
              <h1 className="text-xl font-semibold text-gray-900 truncate min-w-0" title={data.name}>{data.name}</h1>
              {isLocked && <Lock size={13} className="text-gray-400 shrink-0" />}
              {!isLocked && (
                <button
                  onClick={() => { setNameEdit(data.name); setEditingName(true) }}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700 rounded shrink-0"
                  title="Rename formulation"
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
                onChange={e => { if (e.target.value !== data.id) router.push(`/formulations/${e.target.value}`) }}
                title="Switch iteration"
                className="text-sm text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
              >
                {data.iterations.map(it => (
                  <option key={it.id} value={it.id}>
                    v{it.version}{iterationLabel(it.iterationNote)}{it.status === 'locked' ? ' 🔒' : ''}{it.id === data.iterations[0].id ? ' (latest)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-400">v{data.version}</span>
            )}
            <IterationNote formulationId={id} note={data.iterationNote} />
            <span className="capitalize">{data.mode === 'ground_up' ? 'Ground up' : 'Reverse'}</span>
            <span className={`px-1.5 py-0.5 rounded font-medium ${
              isLocked ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {data.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {isDirty && !isLocked && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm
                         rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={13} />
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
          {data.mode === 'reverse' && (
            <button
              onClick={() => setShowReverseWizard(true)}
              title="Run the reverse-engineer wizard to find an ingredient blend matching a target label"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-600
                         text-sm rounded-md hover:bg-violet-50 transition-colors"
            >
              <Zap size={13} /> Reverse wizard
            </button>
          )}
          {(data.project?.targets?.length ?? 0) > 0 && lines.length > 0 && (
            <button
              onClick={() => solveMutation.mutate()}
              disabled={solveMutation.isPending}
              title="Run LP solver to find ingredient weights that satisfy nutritional targets"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white
                         text-sm rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Zap size={13} />
              {solveMutation.isPending ? 'Solving…' : 'Solve'}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowDuplicateMenu(v => !v)}
              disabled={iterateMutation.isPending || forkMutation.isPending}
              title="Duplicate this formulation"
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
          </div>
          {isLocked ? (
            <button
              onClick={() => setConfirmAction('unfinalize')}
              title="Unlock this formulation to allow editing"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-600
                         text-sm rounded-md hover:bg-amber-50 transition-colors"
            >
              <Unlock size={13} /> Unlock
            </button>
          ) : (
            <button
              onClick={() => setConfirmAction('finalize')}
              title="Finalize and lock this formulation"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600
                         text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              <Lock size={13} /> Finalize
            </button>
          )}
          {isLocked && lines.length > 0 && (
            <button
              onClick={() => setShowSaveAsIngredient(true)}
              title="Save this finalized formulation as an ingredient for use in other formulations"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-700
                         text-sm rounded-md hover:bg-blue-50 transition-colors"
            >
              <PackagePlus size={13} /> Save as ingredient
            </button>
          )}
          {calcResult && (
            <button
              onClick={() => setShowNfpDialog(true)}
              title="Generate and download a Nutrition Facts Panel"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 text-green-700
                         text-sm rounded-md hover:bg-green-50 transition-colors"
            >
              <FileText size={13} /> NFP
            </button>
          )}
          <button
            onClick={handlePrint}
            title="Open a print-friendly view in a new tab"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600
                       text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            <Printer size={13} /> Print
          </button>
          {lines.length > 0 && (
            <button
              onClick={() => setShowCompleteBatch(true)}
              title="Record a completed batch — deplete ingredient stock"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700
                         text-sm rounded-md hover:bg-emerald-50 transition-colors"
            >
              <CheckCircle2 size={13} /> Complete batch
            </button>
          )}
          <button
            onClick={() => setConfirmAction('archive')}
            title="Archive this formulation"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500
                       text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            <Archive size={13} /> Archive
          </button>
        </div>
      </div>

      {/* Settings bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100 text-sm print:hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500">Batch (g)</span>
          <WeightInput
            value={batchLocked && batchTargetG != null ? batchTargetG : totalWeightG}
            onChange={commitBatchSize}
            commitOn="blur"
            disabled={isLocked}
            ariaLabel="Batch size (g)"
            title={batchLocked ? 'Locked batch size — quantities rebalance to always total this' : 'Type a batch size to scale the formula to it'}
            className="w-28 px-2 py-0.5 text-right text-sm border border-gray-200 rounded focus:outline-none
                       focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:bg-gray-50 tabular-nums"
          />
          <LockToggle
            active={batchLocked}
            disabled={isLocked}
            onClick={toggleBatchLock}
            lockedTitle="Batch size locked — click to unlock"
            unlockedTitle="Lock the batch size so quantities and usage % always rebalance to it"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Serving (g)</label>
          <input
            type="number"
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
        <div
          className="flex items-center gap-2"
          title={calcResult
            ? `Production loss ${calcResult.processYield.productionLossG.toFixed(1)} g · moisture loss ${calcResult.processYield.moistureLossG.toFixed(1)} g — set per step in Process steps`
            : 'Set loss per step in Process steps'}
        >
          <span className="text-xs font-medium text-gray-500">Yield</span>
          <span className="font-medium text-gray-700">
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

      {/* Sort controls */}
      {lines.length > 1 && !isLocked && (
        <div className="flex items-center gap-1 mb-2 justify-end print:hidden">
          <span className="text-xs text-gray-400 mr-0.5">Sort:</span>
          <button
            onClick={() => sortLines('weight')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ArrowDownNarrowWide size={11} /> By weight
          </button>
          <button
            onClick={() => sortLines('pct')}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ArrowDownNarrowWide size={11} /> By %
          </button>
        </div>
      )}

      {/* Grid table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-2 py-2.5 w-6 print:hidden" />
              <th className="px-3 py-2.5 text-left font-medium w-6">#</th>
              <th className="px-3 py-2.5 text-left font-medium">Ingredient</th>
              <th className="px-3 py-2.5 text-right font-medium w-36">Weight (g)</th>
              <th className="px-3 py-2.5 text-right font-medium w-40">
                <span className="inline-flex items-center gap-1">
                  %
                  <button
                    type="button"
                    onClick={() => changePctDecimals(-1)}
                    disabled={pctDecimals <= PCT_DECIMALS_MIN}
                    title="Show fewer decimal places"
                    className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 print:hidden"
                  >−</button>
                  <span className="text-gray-400 font-normal tabular-nums">{pctDecimals} dp</span>
                  <button
                    type="button"
                    onClick={() => changePctDecimals(1)}
                    disabled={pctDecimals >= PCT_DECIMALS_MAX}
                    title="Show more decimal places (up to 4)"
                    className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 print:hidden"
                  >+</button>
                </span>
              </th>
              {gridNutrients.map(n => (
                <th key={n.id} className="px-3 py-2.5 text-right font-medium w-24">
                  {n.name === 'Total Carbohydrate' ? 'Carbs' : n.name}
                  <span className="text-gray-400 font-normal ml-0.5">/{n.unit}</span>
                </th>
              ))}
              <th className="px-3 py-2.5 w-8 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {lines.map((line) => {
              const linePct = totalWeightG > 0 ? (line.weightG / totalWeightG) * 100 : 0
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
                    isDropTarget   ? 'border-t-2 border-blue-400 bg-blue-50/40' :
                    'hover:bg-gray-50'
                  }`}
                >
                  <td className={`px-2 py-2 print:hidden ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                    {!isLocked && (
                      <GripVertical size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{line.position}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => {
                        setSidebarIngredientId(line.ingredientId)
                        setSidebarLineKey(line.key)
                      }}
                      className="flex items-center gap-1.5 group/name text-left hover:text-blue-600 transition-colors"
                    >
                      <span className="font-medium text-gray-800 group-hover/name:text-blue-600 transition-colors">
                        {line.ingredientName}
                      </span>
                      {line.ingredientVerification !== 'verified' && (
                        <span className="text-xs text-yellow-500" title="Unverified">⚠</span>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <WeightInput
                        value={line.weightG}
                        onChange={g => updateWeight(line.key, String(g))}
                        disabled={isLocked || line.locked || line.pctLocked}
                        title={line.pctLocked ? 'Set by the locked usage % — unlock the % to edit' : undefined}
                      />
                      <LockToggle
                        active={line.locked}
                        disabled={isLocked}
                        onClick={() => toggleQtyLock(line.key)}
                        lockedTitle="Quantity locked — click to unlock"
                        unlockedTitle="Lock this quantity"
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
                        title={line.locked ? 'Set by the locked quantity — unlock the quantity to edit' : undefined}
                      />
                      <LockToggle
                        active={line.pctLocked}
                        disabled={isLocked}
                        onClick={() => togglePctLock(line.key)}
                        lockedTitle="Usage % locked — click to unlock"
                        unlockedTitle="Lock this usage % so it is always this share of the batch"
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
                <td className="px-3 py-2">Total ({lines.length} ingredient{lines.length !== 1 ? 's' : ''})</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatWeightG(totalWeightG)}</td>
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
                <td className="px-3 py-2">Per 100 g finished</td>
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
                <td className="px-3 py-2">Per serving ({servingSizeG} g)</td>
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
      </div>

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
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRow(true)}
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
        <ProcessStepsPanel formulationId={id} steps={data.processSteps ?? []} isLocked={isLocked} />
      </div>

      {/* Full nutrient profile toggle */}
      {calcResult && calcResult.results.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowProfile(p => !p)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showProfile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Full nutrient profile
            <span className="text-xs text-gray-400 font-normal ml-1">
              ({calcResult.results.length} nutrients)
            </span>
          </button>

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
                            <th className="px-4 py-2 text-right font-medium">Per 100 g</th>
                            {servingSizeG && parseFloat(servingSizeG) > 0 && (
                              <th className="px-4 py-2 text-right font-medium">Per serving</th>
                            )}
                            <th className="px-4 py-2 text-right font-medium text-gray-400">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {rows.map(r => (
                            <tr key={r.nutrientId} className="hover:bg-gray-50">
                              <td className="px-4 py-1.5 text-gray-800">{r.name}</td>
                              <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">
                                {formatAmt(r.perFinished100g, r.unit)}
                              </td>
                              {servingSizeG && parseFloat(servingSizeG) > 0 && (
                                <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">
                                  {r.perServing != null ? formatAmt(r.perServing, r.unit) : '—'}
                                </td>
                              )}
                              <td className="px-4 py-1.5 text-right text-gray-400">{r.unit}</td>
                            </tr>
                          ))}
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
        const validations = evaluateTargets(projectTargets, calcResult.results, serving)
        const passes = validations.filter(v => v.status === 'pass').length
        const fails  = validations.filter(v => v.status === 'fail').length
        const warns  = validations.filter(v => v.status === 'warn').length
        return (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Validation</span>
              <span className="text-xs text-gray-400">vs. project targets</span>
              <span className="ml-auto flex items-center gap-2 text-xs">
                {passes > 0 && <span className="text-green-600">{passes} pass</span>}
                {warns > 0  && <span className="text-yellow-600">{warns} warn</span>}
                {fails > 0  && <span className="text-red-600">{fails} fail</span>}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nutrient</th>
                    <th className="px-4 py-2 text-left font-medium">Requirement</th>
                    <th className="px-4 py-2 text-right font-medium">Actual</th>
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
                        <span className="text-gray-400">/ {t.basis === 'per_100g' ? '100 g' : 'serving'}</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                        {actual != null
                          ? `${formatAmt(actual, t.unit)} ${t.unit}`
                          : <span className="text-gray-300 text-xs">
                              {t.basis === 'per_serving' && !serving ? 'set serving size' : '—'}
                            </span>
                        }
                      </td>
                      <td className="px-4 py-2 flex justify-center">{statusIcon(status)}</td>
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
            <span className="text-sm font-medium text-violet-700">LP Solver</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              solverResult.status === 'optimal'    ? 'bg-green-100 text-green-700' :
              solverResult.status === 'infeasible' ? 'bg-red-100 text-red-700' :
                                                     'bg-gray-100 text-gray-600'
            }`}>
              {solverResult.status}
            </span>
            {solverResult.status === 'optimal' && (
              <span className="text-xs text-gray-400">{solverResult.solveTimeMs}ms</span>
            )}
            <button
              onClick={() => setShowSolverPanel(false)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>

          {/* Infeasible / error message */}
          {solverResult.status !== 'optimal' && solverResult.message && (
            <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-violet-100">
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
                      <th className="text-right font-medium pb-1.5 pr-2">Suggested %</th>
                      <th className="text-right font-medium pb-1.5 pr-2">New weight (g)</th>
                      <th className="text-right font-medium pb-1.5">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lines.map(l => {
                      const curPct = totalWeightG > 0 ? (l.weightG / totalWeightG) * 100 : 0
                      const sugPct = solverResult.suggestedPcts[l.key] ?? curPct
                      const delta = sugPct - curPct
                      const newW = Math.round(((sugPct / 100) * totalWeightG) * 10) / 10
                      return (
                        <tr key={l.key} className={l.locked ? 'opacity-50' : ''}>
                          <td className="py-1.5 text-gray-800">
                            {l.ingredientName}
                            {l.locked && <span className="ml-1 text-xs text-gray-400">(locked)</span>}
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
                Constraint Audit
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th className="text-left font-medium pb-1.5">Target</th>
                      <th className="text-left font-medium pb-1.5">Requirement</th>
                      <th className="text-right font-medium pb-1.5 pr-2">Achieved</th>
                      <th className="text-right font-medium pb-1.5 pr-2">Slack</th>
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
                        <td className="py-1.5 flex justify-center">
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
        excludeId={sidebarIngredientId}
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
            setLines(newLines.map(l => ({ ...l, pctLocked: false, lockedPct: null })))
            setIsDirty(true)
            setShowReverseWizard(false)
            toast.success('Formula loaded — review and save when ready')
          }}
          onClose={() => setShowReverseWizard(false)}
        />
      )}

      {showNfpDialog && calcResult && (
        <NfpDialog
          formName={data.name}
          servingSizeG={servingSizeG ? parseFloat(servingSizeG) : undefined}
          batchSizeG={totalWeightG}
          results={calcResult.results}
          defaultIngredients={[...lines]
            .sort((a, b) => b.weightG - a.weightG)
            .map(l => l.ingredientName)
            .join(', ')}
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
