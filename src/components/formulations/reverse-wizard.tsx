'use client'

import { uploadStaged } from '@/lib/upload-file'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  X, Plus, Trash2, ChevronRight, ChevronLeft, Zap, Search, Database,
  Upload, ImageIcon, CheckCircle2, XCircle, AlertCircle, Link2, Unlink,
  FileText, Sparkles, FlaskConical, RotateCcw, Globe, ExternalLink, Save, PackagePlus,
} from 'lucide-react'
import type { Nutrient } from '@/lib/types'
import type { SolverResult } from '@/lib/solver'
import { convertToUnit } from '@/lib/units'
import { categoryPath } from '@/lib/ingredient-categories'
import { UsdaSearchDialog } from '@/components/ingredients/usda-search-dialog'
import { MANUAL_NUTRIENTS, NewLibraryIngredientPanel } from '@/components/formulations/new-library-ingredient-panel'
import { Term } from '@/components/term'

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 'entry' | 'label' | 'link' | 'research' | 'solve'
type EntryMode = 'image' | 'manual'

type TargetRow = { id: string; nutrientName: string; value: string; unit: string }

type DeckIngredient = {
  id: string
  rawName: string
  subIngredients: string[]
  parentBlendName?: string
  linkedIngredientId: string | null
  linkedIngredientName: string | null
  nutrients: NutrientInfo[]
  minPct: string
  maxPct: string
  status: 'unlinked' | 'library' | 'usda' | 'skipped'
}

type NutrientInfo = {
  nutrientId: string; name: string; unit: string; category: string; amountPer100g: number
}

type ResearchResult = {
  productCategory: string
  formulationApproach: string
  ingredientSuggestions: Array<{
    rawName: string
    suggestions: Array<{ ingredient: string; rationale: string; searchQuery: string }>
  }>
  approximatePercentages: Array<{
    ingredient: string; estimatedMinPct: number; estimatedMaxPct: number; rationale: string
  }>
  constraints: string[]
  onHandMatches?: Array<{ rawName: string; ingredientId: string; ingredientName: string; rationale: string }>
  additionalNotes: string
}

// A library search hit: name, category path and on-hand badge
type LibrarySearchHit = {
  id: string; name: string; onHand?: boolean
  category?: string | null; subcategory?: string | null; microCategory?: string | null
}

function LibraryHitLabel({ ing }: { ing: LibrarySearchHit }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="min-w-0">
        <span className="block truncate">{ing.name}</span>
        {ing.category && <span className="block text-xs text-gray-400 truncate">{categoryPath(ing)}</span>}
      </span>
      {ing.onHand && (
        <span
          className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700"
          data-tip="You have this ingredient in the lab."
        >
          On hand
        </span>
      )}
    </span>
  )
}

type ExtraCandidate = {
  ingredientId: string; name: string; verification: string; minPct: string; maxPct: string
  nutrients: NutrientInfo[]
}

type UsdaCandidate = {
  fdcId: number; description: string; dataType: string
  brandOwner?: string
  keyNutrients: Array<{ name: string; amount: number; unit: string }>
}

type ParsedNutrientEntry = { name: string; amountPer100g: number; unit: string }

type WebSearchResult = { title: string; url: string; snippet: string }

type DeckLinkState = {
  candidates: UsdaCandidate[]
  isSearching: boolean
  activeTab: 'usda' | 'url' | 'manual' | 'doc'
  customUrl: string
  isFetchingUrl: boolean
  fetchedNutrients: ParsedNutrientEntry[] | null
  fetchError: string | null
  manualNutrients: Record<string, string>
  isLinking: boolean
  isParsingDoc: boolean
  parsedDocNutrients: ParsedNutrientEntry[] | null
  docParseError: string | null
  webSearchQuery: string
  isWebSearching: boolean
  webSearchResults: WebSearchResult[]
  webSearchError: string | null
}

// ── Link-picker constants & helpers ──────────────────────────────────────────

/** Nutrients the server left out because their unit couldn't be converted to the stored one. */
function warnUnconvertible(names: string[] | undefined) {
  if (names?.length) toast.warning(`Skipped — unit couldn't be converted: ${names.join(', ')}`)
}

function defaultLinkState(): DeckLinkState {
  return {
    candidates: [], isSearching: false, activeTab: 'usda',
    customUrl: '', isFetchingUrl: false, fetchedNutrients: null, fetchError: null,
    manualNutrients: Object.fromEntries(MANUAL_NUTRIENTS.map(n => [n.name, ''])),
    isLinking: false,
    isParsingDoc: false, parsedDocNutrients: null, docParseError: null,
    webSearchQuery: '', isWebSearching: false, webSearchResults: [], webSearchError: null,
  }
}

const DATA_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  'Foundation':     { label: 'Foundation', cls: 'bg-green-100 text-green-700'   },
  'SR Legacy':      { label: 'SR Legacy',  cls: 'bg-blue-100 text-blue-700'     },
  'Survey (FNDDS)': { label: 'Survey',     cls: 'bg-purple-100 text-purple-700' },
  'Branded':        { label: 'Branded',    cls: 'bg-gray-100 text-gray-600'     },
}

// What each USDA data type means, shown on its badge
const DATA_TYPE_TIP: Record<string, string> = {
  'Foundation':     'USDA Foundation Foods: analysed samples with detailed, well-documented values.',
  'SR Legacy':      'USDA SR Legacy: the long-standing USDA reference data, no longer updated.',
  'Survey (FNDDS)': 'USDA survey foods (FNDDS): typical foods as eaten, used in dietary surveys.',
  'Branded':        'USDA Branded Foods: values from a manufacturer’s label, often less complete.',
}

// Hover help shared by the link step, the research step and the phone dialog
const TIP = {
  link: 'Linking ties a label ingredient to an ingredient with nutrition data, so the solver can use its numbers.',
  library: 'Search your ingredient library and link one.',
  usda: 'Search USDA FoodData Central. The food you pick is added to your library and linked.',
  url: 'Find a web page with this ingredient’s nutrition facts and read the values from it with AI.',
  addNew: 'In the lab but not in your library? Adds it to the library, with its nutrition, and links it.',
  skip: 'Leaves this ingredient out: the solver won’t use it and it won’t be added to the formulation.',
  unskip: 'Brings this ingredient back so you can link it.',
  unlink: 'Removes the link so you can choose another source. The library ingredient isn’t deleted.',
  bounds: 'The lowest and highest % of the batch the solver may give this ingredient. AI research can fill these in.',
  blend: 'A compound ingredient: the label lists its own ingredients in parentheses. Its parts are listed under it.',
  webSearch: 'Searches the web for pages with this ingredient’s nutrition facts.',
  openPage: 'Opens the page in a new tab so you can check it first.',
  fetch: 'Reads the nutrition values from this page with AI, per 100 g. Check them before saving.',
  saveLink: 'Adds this ingredient to your library with these values and links it to the label ingredient.',
  saveDraft: 'Saves your progress so you can resume later. Label photos aren’t kept, only what was read from them.',
  close: 'Closes the wizard. If there’s unsaved progress, you’re offered a draft save first.',
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_TARGETS: TargetRow[] = [
  { id: 't1', nutrientName: 'Energy',             value: '', unit: 'kcal' },
  { id: 't2', nutrientName: 'Protein',            value: '', unit: 'g'    },
  { id: 't3', nutrientName: 'Total Fat',          value: '', unit: 'g'    },
  { id: 't4', nutrientName: 'Total Carbohydrate', value: '', unit: 'g'    },
  { id: 't5', nutrientName: 'Dietary Fiber',      value: '', unit: 'g'    },
]

function newDeckItem(rawName: string, subIngredients: string[] = [], id?: string, parentBlendName?: string): DeckIngredient {
  return {
    id: id ?? `d-${Date.now()}-${Math.random()}`,
    rawName, subIngredients, parentBlendName,
    linkedIngredientId: null, linkedIngredientName: null,
    nutrients: [], minPct: '0', maxPct: '100', status: 'unlinked',
  }
}

function parseIngredientDeck(text: string): DeckIngredient[] {
  // Tokenise at top level, respecting parentheses so commas inside (blend) groups don't split
  const topLevel: string[] = []
  let buf = ''
  let depth = 0
  for (const ch of text) {
    if (ch === '(') { depth++; buf += ch }
    else if (ch === ')') { depth--; buf += ch }
    else if ((ch === ',' || ch === '\n') && depth === 0) {
      const t = buf.trim()
      if (t) topLevel.push(t)
      buf = ''
    } else { buf += ch }
  }
  const last = buf.trim()
  if (last) topLevel.push(last)

  const results: DeckIngredient[] = []
  for (const token of topLevel) {
    const parenStart = token.indexOf('(')
    if (parenStart !== -1 && token.endsWith(')')) {
      const name = token.slice(0, parenStart).trim()
      const inner = token.slice(parenStart + 1, -1)
      const subs = inner.split(',').map(s => s.trim()).filter(Boolean)
      if (name && subs.length > 0) {
        results.push(newDeckItem(name, subs))
        subs.forEach(sub => results.push(newDeckItem(sub, [], undefined, name)))
        continue
      }
    }
    results.push(newDeckItem(token))
  }
  return results
}

// ── Step indicator ─────────────────────────────────────────────────────────────

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'entry',    label: 'Start'        },
  { key: 'label',    label: 'Label data'   },
  { key: 'link',     label: 'Link ingr.'   },
  { key: 'research', label: 'AI research'  },
  { key: 'solve',    label: 'Solve'        },
]

function StepDots({ step }: { step: WizardStep }) {
  const idx = STEPS.findIndex(s => s.key === step)
  return (
    <>
    {/* Phones: "Step 3 of 5 · Link ingr." over a segmented bar */}
    <div className="sm:hidden w-full">
      <p className="text-xs text-gray-500 mb-1">
        Step {idx + 1} of {STEPS.length} · <span className="font-medium text-violet-700">{STEPS[idx]?.label}</span>
      </p>
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`h-1 flex-1 rounded-full ${i <= idx ? 'bg-violet-500' : 'bg-gray-200'}`} />
        ))}
      </div>
    </div>
    <div className="hidden sm:flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done   = i < idx
        const active = i === idx
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              active ? 'bg-violet-600 text-white' :
              done   ? 'bg-violet-100 text-violet-600' :
                       'bg-gray-100 text-gray-400'
            }`}>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                active ? 'bg-white/20' : done ? 'bg-violet-300' : 'bg-gray-200'
              }`}>{i + 1}</span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${done ? 'bg-violet-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
    </>
  )
}

// ── Drafts ───────────────────────────────────────────────────────────────────

// What "Save as draft" keeps: everything entered or found so far. Label photos aren't kept, only what was
// read from them; the solver result isn't either (re-running it is quick).
type WizardDraft = {
  v: 1
  step: WizardStep
  mode: EntryMode | null
  productName: string
  labelServingG: string
  batchSizeG: string
  targets: TargetRow[]
  deckIngredients: DeckIngredient[]
  manualDeckText: string
  claims: string[]
  impliedConstraints: string[]
  extraCandidates: ExtraCandidate[]
  researchResult: ResearchResult | null
  usdaCandidates: Record<string, UsdaCandidate[]>
}

function isWizardDraft(d: unknown): d is WizardDraft {
  if (!d || typeof d !== 'object') return false
  const x = d as Partial<WizardDraft>
  return x.v === 1 && STEPS.some(s => s.key === x.step) && Array.isArray(x.targets) && Array.isArray(x.deckIngredients)
}

// ── Phone layout ─────────────────────────────────────────────────────────────

/** True below Tailwind's `sm` breakpoint, where each ingredient opens in its own full-screen dialog */
function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

/** Full-screen dialog for one ingredient on a phone, with previous/next to move through the list */
function IngredientSheet({ title, subtitle, onClose, onPrev, onNext, children }: {
  title: string
  subtitle: string
  onClose: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">{subtitle}</p>
          <h3 className="text-base font-semibold text-gray-900 break-words">{title}</h3>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-2 -m-1 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      <div className="flex gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200">
        <button
          onClick={onPrev ?? undefined} disabled={!onPrev}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-sm border border-gray-200 rounded-md text-gray-600 disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <button onClick={onClose} className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-md">Done</button>
        <button
          onClick={onNext ?? undefined} disabled={!onNext}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-sm border border-gray-200 rounded-md text-gray-600 disabled:opacity-40"
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ── Inline library search for linking ─────────────────────────────────────────

function LibraryLinkSearch({
  onLink,
  onClose,
}: {
  onLink: (id: string, name: string, nutrients: NutrientInfo[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LibrarySearchHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/ingredients?q=${encodeURIComponent(query)}&limit=6`)
      if (r.ok) setResults(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  async function pick(ing: { id: string; name: string }) {
    const r = await fetch(`/api/ingredients/${ing.id}`)
    if (!r.ok) { toast.error('Could not load ingredient'); return }
    const detail = await r.json()
    onLink(ing.id, ing.name, (detail.nutrients ?? []).map((n: {
      nutrientId: string; amountPer100g: string
      nutrient: { id: string; name: string; unit: string; category: string }
    }) => ({
      nutrientId: n.nutrientId, amountPer100g: parseFloat(n.amountPer100g),
      name: n.nutrient.name, unit: n.nutrient.unit, category: n.nutrient.category,
    })))
    onClose()
  }

  return (
    <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-30 relative">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-100">
        <Search size={12} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Search library…"
          className="flex-1 text-sm outline-none"
        />
        <button onClick={onClose} aria-label="Close search" data-tip="Closes the library search.">
          <X size={12} className="text-gray-300 hover:text-gray-500" />
        </button>
      </div>
      {results.map(ing => (
        <button
          key={ing.id}
          onClick={() => pick(ing)}
          data-tip="Links the label ingredient to this library ingredient and uses its nutrition data."
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 border-b border-gray-50"
        >
          <LibraryHitLabel ing={ing} />
        </button>
      ))}
      {query && results.length === 0 && (
        <div className="px-3 py-2 text-xs text-gray-400">No matches found</div>
      )}
    </div>
  )
}

// ── DeckLinkCard ─────────────────────────────────────────────────────────────

function DeckLinkCard({
  item, linkState, onImportCandidate, onFetchUrl, onFetchUrlFrom, onWebSearch,
  onSaveExternal, onSkip, onUpdateLinkState, onParseDoc, onAddNew,
}: {
  item: DeckIngredient
  linkState: DeckLinkState | undefined
  onImportCandidate: (fdcId: number) => void
  onFetchUrl: () => void
  onFetchUrlFrom: (url: string) => void
  onWebSearch: (query: string) => void
  onSaveExternal: (source: 'url' | 'manual' | 'doc') => void
  onSkip: () => void
  onUpdateLinkState: (patch: Partial<DeckLinkState>) => void
  onParseDoc: (file: File) => void
  onAddNew: () => void
}) {
  const ls = linkState ?? defaultLinkState()
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-800">{item.rawName}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onAddNew}
            data-tip={TIP.addNew}
            className="flex items-center gap-1 text-xs text-green-700 px-2 py-1 sm:py-0.5 rounded border border-green-200 hover:bg-green-50 transition-colors"
          >
            <PackagePlus size={11} /> Add new
          </button>
          <button onClick={onSkip} data-tip={TIP.skip} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 sm:py-0.5 rounded hover:bg-gray-100 transition-colors">
            Skip
          </button>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {(['usda', 'url', 'manual', 'doc'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onUpdateLinkState({ activeTab: tab })}
            data-tip={{
              usda: 'USDA FoodData Central matches found for this ingredient. Pick one to import and link it.',
              url: TIP.url,
              manual: 'Type the nutrition values per 100 g yourself.',
              doc: 'Read the nutrition values from a spec sheet or COA with AI.',
            }[tab]}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              ls.activeTab === tab
                ? 'border-violet-500 text-violet-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'usda'   && <><Database size={10} /> USDA</>}
            {tab === 'url'    && <><Link2 size={10} /> URL</>}
            {tab === 'manual' && <><FileText size={10} /> Manual</>}
            {tab === 'doc'    && <><Upload size={10} /> Document</>}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="p-3">

        {ls.activeTab === 'usda' && (
          <div>
            {ls.isSearching && (
              <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-400 rounded-full animate-spin" />
                Searching USDA…
              </div>
            )}
            {!ls.isSearching && ls.candidates.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No USDA matches found — try URL or manual entry.</p>
            )}
            {!ls.isSearching && ls.candidates.length > 0 && (
              <div className="space-y-2">
                {ls.candidates.map(cand => {
                  const badge = DATA_TYPE_BADGE[cand.dataType] ?? { label: cand.dataType, cls: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={cand.fdcId} className="flex items-start gap-2 p-2 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm text-gray-800 font-medium leading-tight">{cand.description}</span>
                          <span
                            className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}
                            data-tip={DATA_TYPE_TIP[cand.dataType]}
                          >
                            {badge.label}
                          </span>
                        </div>
                        {cand.brandOwner && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{cand.brandOwner}</p>
                        )}
                        {cand.keyNutrients.length > 0 && (
                          <div className="flex flex-wrap gap-x-3 mt-1">
                            {cand.keyNutrients.map(n => (
                              <span key={n.name} className="text-xs text-gray-400">
                                {n.amount % 1 === 0 ? n.amount : n.amount.toFixed(1)}{n.unit} {n.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onImportCandidate(cand.fdcId)}
                        data-tip="Imports this USDA food into your library and links it to the label ingredient."
                        disabled={ls.isLinking}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs border border-blue-200 rounded-md bg-white hover:bg-blue-50 text-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {ls.isLinking
                          ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                          : <CheckCircle2 size={11} />
                        }
                        Use this
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {ls.activeTab === 'url' && (
          <div className="space-y-3">

            {/* ── Web search ── */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Search online for a nutrition page</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ls.webSearchQuery || item.rawName}
                  onChange={e => onUpdateLinkState({ webSearchQuery: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') onWebSearch(ls.webSearchQuery || item.rawName)
                  }}
                  placeholder={item.rawName}
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={() => onWebSearch(ls.webSearchQuery || item.rawName)}
                  data-tip={TIP.webSearch}
                  disabled={ls.isWebSearching}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {ls.isWebSearching
                    ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    : <Globe size={11} />
                  }
                  Search
                </button>
              </div>
              {ls.webSearchError && (
                <div className="mt-1.5 p-2 bg-red-50 rounded-md text-xs text-red-600 border border-red-100">{ls.webSearchError}</div>
              )}
              {ls.webSearchResults.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {ls.webSearchResults.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{r.title}</p>
                        <p className="text-[10px] text-blue-600 truncate">{r.url}</p>
                        {r.snippet && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{r.snippet}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 items-start pt-0.5">
                        <a
                          href={r.url}
                          data-tip={TIP.openPage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 text-[10px] border border-gray-200 rounded hover:bg-gray-50 text-gray-500 transition-colors"
                        >
                          <ExternalLink size={9} /> Open
                        </a>
                        <button
                          onClick={() => onFetchUrlFrom(r.url)}
                          data-tip={TIP.fetch}
                          disabled={ls.isFetchingUrl}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] border border-violet-200 rounded hover:bg-violet-50 text-violet-600 disabled:opacity-50 transition-colors"
                        >
                          <Sparkles size={9} /> Fetch
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Paste URL directly ── */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 mb-1.5">Or paste a URL directly</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={ls.customUrl}
                  onChange={e => onUpdateLinkState({ customUrl: e.target.value, fetchedNutrients: null, fetchError: null })}
                  onKeyDown={e => { if (e.key === 'Enter' && ls.customUrl) onFetchUrl() }}
                  placeholder="https://tools.myfooddata.com/nutrition-facts/..."
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={onFetchUrl}
                  data-tip={ls.customUrl ? TIP.fetch : 'Paste a URL first.'}
                  disabled={!ls.customUrl || ls.isFetchingUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {ls.isFetchingUrl
                    ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    : <Sparkles size={11} />
                  }
                  Fetch
                </button>
              </div>
            </div>

            {ls.fetchError && (
              <div className="p-2 bg-red-50 rounded-md text-xs text-red-600 border border-red-100">{ls.fetchError}</div>
            )}
            {ls.fetchedNutrients && ls.fetchedNutrients.length > 0 && (
              <div className="space-y-2">
                <div className="border border-green-100 rounded-lg overflow-hidden">
                  <div className="bg-green-50 px-2.5 py-1.5 border-b border-green-100">
                    <span className="text-xs font-medium text-green-700">Extracted · <Term t="per100g">per 100 g</Term></span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-50">
                      {ls.fetchedNutrients.map((n, i) => (
                        <tr key={i}>
                          <td className="px-2.5 py-1.5 text-gray-700">{n.name}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-gray-600 font-medium">{n.amountPer100g} {n.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => onSaveExternal('url')}
                  data-tip={TIP.saveLink}
                  disabled={ls.isLinking}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {ls.isLinking ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={12} />}
                  Save & Link
                </button>
              </div>
            )}
          </div>
        )}

        {ls.activeTab === 'manual' && (
          <div className="space-y-2.5">
            <p className="text-xs text-gray-400">Enter values per 100 g of this ingredient</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {MANUAL_NUTRIENTS.map(mn => (
                <div key={mn.name} className="flex items-center gap-2">
                  <label className="text-sm sm:text-xs text-gray-600 flex-1 min-w-0">{mn.name}</label>
                  <input
                    type="number" inputMode="decimal" min="0" step="any"
                    value={ls.manualNutrients[mn.name] ?? ''}
                    onChange={e => onUpdateLinkState({ manualNutrients: { ...ls.manualNutrients, [mn.name]: e.target.value } })}
                    placeholder="0"
                    className="w-24 sm:w-20 px-2 py-2 sm:py-1 text-base sm:text-xs text-right border border-gray-200 rounded tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <span className="text-xs text-gray-400 w-8 shrink-0">{mn.unit}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => onSaveExternal('manual')}
              data-tip={TIP.saveLink}
              disabled={ls.isLinking}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {ls.isLinking ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={12} />}
              Save & Link
            </button>
          </div>
        )}

        {ls.activeTab === 'doc' && (
          <div className="space-y-2.5">
            <p className="text-xs text-gray-400">Upload a COA or spec sheet — PDF, PNG, JPEG, or WEBP (max 20 MB)</p>
            <label
              data-tip="Upload a spec sheet or COA. AI reads its nutrition values for you to check, then Save & Link."
              className={`flex items-center gap-2 px-3 py-2.5 text-sm border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              ls.isParsingDoc ? 'border-violet-200 bg-violet-50/30' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/20'
            }`}>
              <Upload size={14} className="text-gray-400 shrink-0" />
              <span className="text-gray-500">{ls.isParsingDoc ? 'Extracting nutrition data…' : 'Choose file or drop here'}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={ls.isParsingDoc}
                onChange={e => { const f = e.target.files?.[0]; if (f) onParseDoc(f); e.target.value = '' }}
              />
            </label>
            {ls.isParsingDoc && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-violet-400 rounded-full animate-spin" />
                Parsing document with AI…
              </div>
            )}
            {ls.docParseError && (
              <div className="p-2 bg-red-50 rounded-md text-xs text-red-600 border border-red-100">{ls.docParseError}</div>
            )}
            {ls.parsedDocNutrients && ls.parsedDocNutrients.length > 0 && (
              <div className="space-y-2">
                <div className="border border-green-100 rounded-lg overflow-hidden">
                  <div className="bg-green-50 px-2.5 py-1.5 border-b border-green-100">
                    <span className="text-xs font-medium text-green-700">Extracted · <Term t="per100g">per 100 g</Term></span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-50">
                      {ls.parsedDocNutrients.map((n, i) => (
                        <tr key={i}>
                          <td className="px-2.5 py-1.5 text-gray-700">{n.name}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-gray-600 font-medium">{n.amountPer100g} {n.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => onSaveExternal('doc')}
                  data-tip={TIP.saveLink}
                  disabled={ls.isLinking}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {ls.isLinking ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={12} />}
                  Save & Link
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ReverseWizard({
  formulationId,
  onApply,
  onClose,
}: {
  formulationId: string
  onApply: (lines: {
    key: string; ingredientId: string; ingredientName: string; ingredientVerification: string
    position: number; weightG: number; locked: boolean; nutrients: NutrientInfo[]
  }[]) => void
  onClose: () => void
}) {
  // ── Step & mode ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('entry')
  const [mode, setMode] = useState<EntryMode | null>(null)

  // ── Image state ──────────────────────────────────────────────────────────────
  const MAX_IMAGES = 4
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Label data ───────────────────────────────────────────────────────────────
  const [productName, setProductName] = useState('')
  const [labelServingG, setLabelServingG] = useState('')  // serving size from label
  const [batchSizeG, setBatchSizeG] = useState('1000')   // what to produce
  const [targets, setTargets] = useState<TargetRow[]>(DEFAULT_TARGETS)
  const [deckIngredients, setDeckIngredients] = useState<DeckIngredient[]>([])
  const [manualDeckText, setManualDeckText] = useState('')
  const [claims, setClaims] = useState<string[]>([])
  const [impliedConstraints, setImpliedConstraints] = useState<string[]>([])

  // ── Ingredient linking ───────────────────────────────────────────────────────
  const [linkSearchOpenId, setLinkSearchOpenId] = useState<string | null>(null)
  const [urlPanelOpenId, setUrlPanelOpenId] = useState<string | null>(null)
  const [usdaOpen, setUsdaOpen] = useState(false)
  const [usdaQuery, setUsdaQuery] = useState('')
  const [usdaTargetId, setUsdaTargetId] = useState<string | null>(null)
  const [extraCandidates, setExtraCandidates] = useState<ExtraCandidate[]>([])
  const [extraSearchQuery, setExtraSearchQuery] = useState('')
  const [extraSearchResults, setExtraSearchResults] = useState<LibrarySearchHit[]>([])

  // ── Research ─────────────────────────────────────────────────────────────────
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null)
  const [isResearching, setIsResearching] = useState(false)
  const [researchError, setResearchError] = useState<string | null>(null)
  const [deckLinkStates, setDeckLinkStates] = useState<Record<string, DeckLinkState>>({})

  // ── Solve ─────────────────────────────────────────────────────────────────────
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null)
  const [isSolving, setIsSolving] = useState(false)

  // ── Phone layout: one ingredient at a time in a full-screen dialog ───────────
  const isMobile = useIsMobile()
  const [newPanelOpenId, setNewPanelOpenId] = useState<string | null>(null)
  // The ingredients the open dialog moves through (the list it was opened from) and which one is showing
  const [sheet, setSheet] = useState<{ ids: string[]; index: number } | null>(null)

  // ── Draft ────────────────────────────────────────────────────────────────────
  const queryClient = useQueryClient()
  const draftKey = ['reverse-draft', formulationId]
  const { data: savedDraft } = useQuery<{ draft: unknown; savedAt: string | null }>({
    queryKey: draftKey,
    queryFn: () => fetch(`/api/formulations/${formulationId}/reverse-draft`)
      .then(r => (r.ok ? r.json() : { draft: null, savedAt: null })),
  })
  const [draftOfferDismissed, setDraftOfferDismissed] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [closePromptOpen, setClosePromptOpen] = useState(false)
  // JSON of the last saved (or resumed) draft, to tell whether there's anything unsaved
  const savedSnapshotRef = useRef<string | null>(null)
  const markSavedOnRenderRef = useRef(false)
  // A resumed draft that already has research results shouldn't call Claude again on arrival
  const skipResearchRunRef = useRef(false)

  const { data: allNutrients } = useQuery<Nutrient[]>({
    queryKey: ['nutrients-all'],
    queryFn: () => fetch('/api/nutrients').then(r => r.json()),
    staleTime: Infinity,
  })

  // ── Image handlers ───────────────────────────────────────────────────────────

  function onFilesSelect(files: File[]) {
    const imageOnly = files.filter(f => f.type.startsWith('image/'))
    if (imageOnly.length === 0) return
    setImageFiles(prev => {
      const next = [...prev, ...imageOnly].slice(0, MAX_IMAGES)
      if (prev.length + imageOnly.length > MAX_IMAGES) toast.error(`Up to ${MAX_IMAGES} images allowed`)
      return next
    })
  }

  function removeImage(idx: number) {
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    const urls = imageFiles.map(f => URL.createObjectURL(f))
    setImagePreviews(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [imageFiles])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    onFilesSelect(Array.from(e.dataTransfer.files))
  }

  // Compress photos client-side before upload — phone camera shots can be 8-15 MB each,
  // and even a couple of them together exceed Vercel's 4.5 MB serverless request body limit.
  function compressImage(file: File): Promise<File> {
    return new Promise(resolve => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 2048
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        let quality = 0.88
        const tryBlob = () => {
          canvas.toBlob(blob => {
            if (!blob) { resolve(file); return }
            if (blob.size <= 1 * 1024 * 1024 || quality < 0.3) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            } else { quality -= 0.15; tryBlob() }
          }, 'image/jpeg', quality)
        }
        tryBlob()
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  async function parseLabel() {
    if (imageFiles.length === 0) return
    setIsParsing(true)
    try {
      const compressed = await Promise.all(imageFiles.map(compressImage))
      const fd = new FormData()
      compressed.forEach(f => fd.append('images', f))
      const r = await fetch(`/api/formulations/${formulationId}/parse-label`, { method: 'POST', body: fd })
      const text = await r.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any
      try { data = JSON.parse(text) }
      catch { throw new Error(r.status === 413 ? 'Photos too large — try fewer or smaller images' : `Server error ${r.status}`) }
      if (!r.ok) throw new Error(data.error ?? 'Parse failed')

      setProductName(data.productName ?? '')
      setLabelServingG(data.servingSizeG ? String(data.servingSizeG) : '')
      setTargets(
        (data.nutrients ?? []).map((n: { name: string; value: number; unit: string }, i: number) => ({
          id: `parsed-${i}`,
          nutrientName: n.name,
          value: String(n.value),
          unit: n.unit,
        }))
      )
      setDeckIngredients(
        (data.deckIngredients ?? []).flatMap((ing: { name: string; subIngredients?: string[] }) => {
          const subs = ing.subIngredients ?? []
          if (subs.length > 0) {
            return [
              newDeckItem(ing.name, subs),
              ...subs.map((sub: string) => newDeckItem(sub, [], undefined, ing.name)),
            ]
          }
          return [newDeckItem(ing.name)]
        })
      )
      setClaims(data.claims ?? [])
      setImpliedConstraints((data.impliedConstraints ?? []).map((c: { constraint: string }) => c.constraint))
      toast.success('Label parsed successfully')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setIsParsing(false)
    }
  }

  // ── Manual deck parsing ──────────────────────────────────────────────────────

  function applyManualDeck() {
    setDeckIngredients(parseIngredientDeck(manualDeckText))
  }

  // ── Ingredient linking ───────────────────────────────────────────────────────

  function linkDeckItem(id: string, ingredientId: string, name: string, nutrients: NutrientInfo[], source: 'library' | 'usda') {
    setDeckIngredients(prev => prev.map(d => d.id === id
      ? { ...d, linkedIngredientId: ingredientId, linkedIngredientName: name, nutrients, status: source }
      : d
    ))
  }

  function unlinkDeckItem(id: string) {
    setDeckIngredients(prev => prev.map(d => d.id === id
      ? { ...d, linkedIngredientId: null, linkedIngredientName: null, nutrients: [], status: 'unlinked' }
      : d
    ))
  }

  function skipDeckItem(id: string) {
    setDeckIngredients(prev => prev.map(d => d.id === id ? { ...d, status: 'skipped' } : d))
  }

  function updateLinkState(id: string, patch: Partial<DeckLinkState>) {
    setDeckLinkStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? defaultLinkState()), ...patch },
    }))
  }

  function updateBound(id: string, field: 'minPct' | 'maxPct', val: string) {
    setDeckIngredients(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d))
  }

  // One link panel open at a time: library search, web URL, or a new library ingredient
  function togglePanel(id: string, kind: 'library' | 'url' | 'new') {
    const open = kind === 'library' ? linkSearchOpenId : kind === 'url' ? urlPanelOpenId : newPanelOpenId
    const next = open === id ? null : id
    setLinkSearchOpenId(kind === 'library' ? next : null)
    setUrlPanelOpenId(kind === 'url' ? next : null)
    setNewPanelOpenId(kind === 'new' ? next : null)
  }

  function openSheet(ids: string[], id: string) {
    setLinkSearchOpenId(null); setUrlPanelOpenId(null); setNewPanelOpenId(null)
    setSheet({ ids, index: Math.max(0, ids.indexOf(id)) })
  }
  function moveSheet(delta: number) {
    setLinkSearchOpenId(null); setUrlPanelOpenId(null); setNewPanelOpenId(null)
    setSheet(s => (s ? { ...s, index: s.index + delta } : s))
  }

  // Link a deck item to an existing library ingredient (an on-hand match from research, or a duplicate
  // found when adding a new one)
  async function linkLibraryIngredient(deckItemId: string, ingredientId: string, message: (name: string) => string) {
    try {
      const r = await fetch(`/api/ingredients/${ingredientId}`)
      if (!r.ok) throw new Error('Could not load ingredient')
      const detail = await r.json()
      const nutrients: NutrientInfo[] = (detail.nutrients ?? []).map((n: {
        nutrientId: string; amountPer100g: string
        nutrient: { id: string; name: string; unit: string; category: string }
      }) => ({
        nutrientId: n.nutrientId, amountPer100g: parseFloat(n.amountPer100g),
        name: n.nutrient.name, unit: n.nutrient.unit, category: n.nutrient.category,
      }))
      linkDeckItem(deckItemId, detail.id, detail.name, nutrients, 'library')
      toast.success(message(detail.name))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  async function onUsdaImported(ingredientId?: string) {
    setUsdaOpen(false)
    if (!ingredientId || !usdaTargetId) { setUsdaTargetId(null); return }
    try {
      const r = await fetch(`/api/ingredients/${ingredientId}`)
      if (!r.ok) throw new Error('Could not load ingredient')
      const detail = await r.json()
      const nutrients: NutrientInfo[] = (detail.nutrients ?? []).map((n: {
        nutrientId: string; amountPer100g: string
        nutrient: { id: string; name: string; unit: string; category: string }
      }) => ({
        nutrientId: n.nutrientId, amountPer100g: parseFloat(n.amountPer100g),
        name: n.nutrient.name, unit: n.nutrient.unit, category: n.nutrient.category,
      }))
      linkDeckItem(usdaTargetId, detail.id, detail.name, nutrients, 'usda')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setUsdaTargetId(null)
    }
  }

  // ── Extra candidate search ───────────────────────────────────────────────────

  useEffect(() => {
    if (!extraSearchQuery.trim()) { setExtraSearchResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/ingredients?q=${encodeURIComponent(extraSearchQuery)}&limit=6`)
      if (r.ok) setExtraSearchResults(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [extraSearchQuery])

  async function addExtraCandidate(ing: { id: string; name: string }) {
    if (extraCandidates.some(c => c.ingredientId === ing.id)) {
      toast.error(`${ing.name} already added`)
      return
    }
    const r = await fetch(`/api/ingredients/${ing.id}`)
    if (!r.ok) { toast.error('Could not load ingredient'); return }
    const detail = await r.json()
    setExtraCandidates(prev => [...prev, {
      ingredientId: ing.id, name: ing.name, verification: detail.verification,
      minPct: '0', maxPct: '100',
      nutrients: (detail.nutrients ?? []).map((n: {
        nutrientId: string; amountPer100g: string
        nutrient: { id: string; name: string; unit: string; category: string }
      }) => ({
        nutrientId: n.nutrientId, amountPer100g: parseFloat(n.amountPer100g),
        name: n.nutrient.name, unit: n.nutrient.unit, category: n.nutrient.category,
      })),
    }])
    setExtraSearchQuery('')
    setExtraSearchResults([])
  }

  // ── Link-picker actions ───────────────────────────────────────────────────────

  async function importCandidate(deckItemId: string, fdcId: number, rawName: string) {
    updateLinkState(deckItemId, { isLinking: true })
    try {
      const r = await fetch(`/api/formulations/${formulationId}/auto-link-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: deckItemId, rawName, searchQuery: '', fdcId }] }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Import failed')
      const result = (data.results as Array<{
        id: string; status: string; ingredientId?: string; ingredientName?: string
        nutrients?: NutrientInfo[]
      }>)[0]
      if (result?.status === 'linked') {
        linkDeckItem(deckItemId, result.ingredientId!, result.ingredientName!,
          (result.nutrients ?? []).map(n => ({
            nutrientId: n.nutrientId, amountPer100g: n.amountPer100g,
            name: n.name, unit: n.unit, category: n.category,
          })), 'usda')
        toast.success(`Linked "${rawName}" from USDA`)
      } else {
        throw new Error('Could not import ingredient')
      }
    } catch (err) {
      toast.error(String(err))
    } finally {
      updateLinkState(deckItemId, { isLinking: false })
    }
  }

  async function webSearchIngredient(deckItemId: string, query: string) {
    updateLinkState(deckItemId, { isWebSearching: true, webSearchError: null, webSearchResults: [] })
    try {
      const r = await fetch('/api/ingredients/search-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Search failed')
      updateLinkState(deckItemId, { webSearchResults: data.results ?? [], isWebSearching: false })
    } catch (err) {
      updateLinkState(deckItemId, { webSearchError: String(err), isWebSearching: false })
    }
  }

  async function fetchUrlNutrition(deckItemId: string, explicitUrl?: string) {
    const ls = deckLinkStates[deckItemId]
    const url = explicitUrl ?? ls?.customUrl
    if (!url) return
    if (explicitUrl) {
      updateLinkState(deckItemId, { customUrl: explicitUrl, fetchedNutrients: null, fetchError: null, activeTab: 'url' })
    }
    updateLinkState(deckItemId, { isFetchingUrl: true, fetchError: null, fetchedNutrients: null })
    try {
      const item = deckIngredients.find(d => d.id === deckItemId)
      const r = await fetch('/api/ingredients/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ingredientName: item?.rawName ?? '' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to fetch URL')
      updateLinkState(deckItemId, { fetchedNutrients: data.nutrients, isFetchingUrl: false })
      warnUnconvertible(data.unconvertible)
    } catch (err) {
      updateLinkState(deckItemId, { fetchError: String(err), isFetchingUrl: false })
    }
  }

  async function parseDoc(deckItemId: string, file: File) {
    const item = deckIngredients.find(d => d.id === deckItemId)
    updateLinkState(deckItemId, { isParsingDoc: true, docParseError: null, parsedDocNutrients: null })
    try {
      // Straight to storage first: large PDFs would be refused by our own server
      const stagedPath = await uploadStaged(file)
      const r = await fetch('/api/ingredients/parse-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagedPath, ingredientName: item?.rawName ?? '' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to parse document')
      updateLinkState(deckItemId, { parsedDocNutrients: data.nutrients, isParsingDoc: false })
      warnUnconvertible(data.unconvertible)
    } catch (err) {
      updateLinkState(deckItemId, { docParseError: String(err), isParsingDoc: false })
    }
  }

  async function saveExternalLink(deckItemId: string, source: 'url' | 'manual' | 'doc') {
    const ls = deckLinkStates[deckItemId]
    const item = deckIngredients.find(d => d.id === deckItemId)
    if (!ls || !item) return

    const nutrientsToSave = source === 'url'
      ? (ls.fetchedNutrients ?? []).map(n => ({ name: n.name, amountPer100g: n.amountPer100g, unit: n.unit }))
      : source === 'doc'
      ? (ls.parsedDocNutrients ?? []).map(n => ({ name: n.name, amountPer100g: n.amountPer100g, unit: n.unit }))
      : MANUAL_NUTRIENTS
          .map(mn => ({ name: mn.name, amountPer100g: parseFloat(ls.manualNutrients[mn.name] ?? '0') || 0, unit: mn.unit }))
          .filter(n => n.amountPer100g > 0)

    if (!nutrientsToSave.length) { toast.error('Enter at least one nutrient value'); return }

    updateLinkState(deckItemId, { isLinking: true })
    try {
      const r = await fetch('/api/ingredients/from-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.rawName,
          sourceType: source === 'manual' ? 'manual' : 'ai_extracted',
          sourceUrl: source === 'url' ? ls.customUrl : undefined,
          nutrients: nutrientsToSave,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to save')
      linkDeckItem(deckItemId, data.ingredientId, data.ingredientName,
        (data.nutrients as NutrientInfo[]).map(n => ({
          nutrientId: n.nutrientId, amountPer100g: n.amountPer100g,
          name: n.name, unit: n.unit, category: n.category,
        })), 'usda')
      toast.success(`Saved & linked "${item.rawName}"`)
      warnUnconvertible(data.unconvertible)
    } catch (err) {
      toast.error(String(err))
    } finally {
      updateLinkState(deckItemId, { isLinking: false })
    }
  }

  // ── AI Research ──────────────────────────────────────────────────────────────

  const runResearch = useCallback(async () => {
    setIsResearching(true)
    setResearchResult(null)
    setResearchError(null)
    setDeckLinkStates({})
    try {
      const r = await fetch(`/api/formulations/${formulationId}/ai-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          servingSizeG: labelServingG ? parseFloat(labelServingG) : null,
          nutrients: targets.filter(t => t.nutrientName && t.value !== '' && parseFloat(t.value) >= 0).map(t => ({
            name: t.nutrientName, value: parseFloat(t.value), unit: t.unit,
          })),
          deckIngredients: deckIngredients.map(d => ({
            rawName: d.rawName,
            subIngredients: d.subIngredients,
            parentBlendName: d.parentBlendName,
            linkedIngredientName: d.linkedIngredientName,
            status: d.status,
          })),
          claims,
          impliedConstraints,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        const msg = typeof data.error === 'string'
          ? data.error
          : JSON.stringify(data.error ?? data)
        throw new Error(`${r.status} — ${msg}`)
      }
      setResearchResult(data)
      setIsResearching(false)

      // ── Phase 2: Fetch USDA candidates for unlinked items (user chooses) ────────
      const unlinkedItems = deckIngredients.filter(d => d.status === 'unlinked')
      if (unlinkedItems.length > 0) {
        // Build search queries from AI suggestions
        const suggestionsMap = new Map<string, string>()
        if (data.ingredientSuggestions) {
          for (const item of data.ingredientSuggestions as ResearchResult['ingredientSuggestions']) {
            if (item.suggestions.length > 0) {
              suggestionsMap.set(item.rawName, item.suggestions[0].searchQuery)
            }
          }
        }
        // Mark all unlinked items as searching
        const initialStates: Record<string, DeckLinkState> = {}
        for (const item of unlinkedItems) {
          initialStates[item.id] = { ...defaultLinkState(), isSearching: true }
        }
        setDeckLinkStates(initialStates)

        try {
          const searchBody = unlinkedItems.map(d => ({
            id: d.id,
            rawName: d.rawName,
            searchQuery: suggestionsMap.get(d.rawName) ?? d.rawName,
          }))
          const searchRes = await fetch(`/api/formulations/${formulationId}/deck-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: searchBody }),
          })
          if (searchRes.ok) {
            const { results } = await searchRes.json() as {
              results: Array<{ id: string; candidates: UsdaCandidate[] }>
            }
            setDeckLinkStates(prev => {
              const next = { ...prev }
              for (const r of results) {
                next[r.id] = { ...(next[r.id] ?? defaultLinkState()), candidates: r.candidates, isSearching: false }
              }
              return next
            })
          }
        } catch (searchErr) {
          console.error('[deck-search] error:', searchErr)
          setDeckLinkStates(prev => {
            const next = { ...prev }
            for (const item of unlinkedItems) {
              next[item.id] = { ...(next[item.id] ?? defaultLinkState()), isSearching: false }
            }
            return next
          })
        }
      }

      // ── Apply approximate % bounds (after auto-link so all items are considered) ──
      if (data.approximatePercentages) {
        setDeckIngredients(prev => {
          let updated = prev.map(d => {
            const match = (data.approximatePercentages as Array<{
              ingredient: string; estimatedMinPct: number; estimatedMaxPct: number
            }>).find(p =>
              d.rawName.toLowerCase().includes(p.ingredient.toLowerCase()) ||
              p.ingredient.toLowerCase().includes(d.rawName.toLowerCase())
            )
            if (!match) return d
            return { ...d, minPct: String(match.estimatedMinPct), maxPct: String(match.estimatedMaxPct) }
          })

          const maxSum = updated.reduce((s, d) => s + (parseFloat(d.maxPct) || 100), 0)
          if (maxSum < 100) {
            const scale = 120 / maxSum
            updated = updated.map(d => ({
              ...d, maxPct: String(Math.min(100, Math.round(parseFloat(d.maxPct) * scale * 10) / 10)),
            }))
          }
          const minSum = updated.reduce((s, d) => s + (parseFloat(d.minPct) || 0), 0)
          if (minSum > 100) {
            const scale = 80 / minSum
            updated = updated.map(d => ({ ...d, minPct: String(Math.round(parseFloat(d.minPct) * scale * 10) / 10) }))
          }
          return updated
        })
      }
    } catch (err) {
      const msg = String(err)
      setResearchError(msg)
      toast.error(msg)
      setIsResearching(false)
    }
  }, [formulationId, productName, labelServingG, targets, deckIngredients, claims, impliedConstraints])

  useEffect(() => {
    if (step !== 'research') return
    if (skipResearchRunRef.current) { skipResearchRunRef.current = false; return }
    runResearch()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // A dialog belongs to the step it was opened on
  useEffect(() => { setSheet(null) }, [step])

  // ── Draft ────────────────────────────────────────────────────────────────────

  function buildDraft(): WizardDraft {
    const usdaCandidates: Record<string, UsdaCandidate[]> = {}
    for (const [id, ls] of Object.entries(deckLinkStates)) if (ls.candidates.length) usdaCandidates[id] = ls.candidates
    return {
      v: 1, step, mode, productName, labelServingG, batchSizeG, targets, deckIngredients, manualDeckText,
      claims, impliedConstraints, extraCandidates, researchResult, usdaCandidates,
    }
  }
  const currentSnapshot = JSON.stringify(buildDraft())
  const hasUnsavedProgress = step !== 'entry' && currentSnapshot !== savedSnapshotRef.current

  useEffect(() => {
    if (!markSavedOnRenderRef.current) return
    markSavedOnRenderRef.current = false
    savedSnapshotRef.current = currentSnapshot
  })

  function restoreDraft(d: WizardDraft, savedAt: string | null) {
    setMode(d.mode)
    setProductName(d.productName ?? '')
    setLabelServingG(d.labelServingG ?? '')
    setBatchSizeG(d.batchSizeG ?? '1000')
    setTargets(d.targets)
    setDeckIngredients(d.deckIngredients)
    setManualDeckText(d.manualDeckText ?? '')
    setClaims(d.claims ?? [])
    setImpliedConstraints(d.impliedConstraints ?? [])
    setExtraCandidates(d.extraCandidates ?? [])
    setResearchResult(d.researchResult ?? null)
    setDeckLinkStates(Object.fromEntries(
      Object.entries(d.usdaCandidates ?? {}).map(([id, candidates]) => [id, { ...defaultLinkState(), candidates }]),
    ))
    if (d.step === 'research' && d.researchResult) skipResearchRunRef.current = true
    setStep(d.step)
    setLastSavedAt(savedAt ? new Date(savedAt) : null)
    markSavedOnRenderRef.current = true
    setDraftOfferDismissed(true)
  }

  async function saveDraft(): Promise<boolean> {
    setIsSavingDraft(true)
    try {
      const data = buildDraft()
      const r = await fetch(`/api/formulations/${formulationId}/reverse-draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not save the draft')
      savedSnapshotRef.current = JSON.stringify(data)
      setLastSavedAt(new Date(body.savedAt ?? Date.now()))
      setDraftOfferDismissed(true)
      queryClient.invalidateQueries({ queryKey: draftKey })
      toast.success(imageFiles.length > 0
        ? 'Draft saved. Label photos aren’t kept, but everything read from them is.'
        : 'Draft saved — pick up where you left off next time you open the wizard')
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setIsSavingDraft(false)
    }
  }

  async function discardDraft() {
    setDraftOfferDismissed(true)
    const r = await fetch(`/api/formulations/${formulationId}/reverse-draft`, { method: 'DELETE' })
    if (!r.ok) toast.error('Could not discard the draft')
    queryClient.invalidateQueries({ queryKey: draftKey })
  }

  function requestClose() {
    if (hasUnsavedProgress) setClosePromptOpen(true)
    else onClose()
  }

  const resumableDraft = !draftOfferDismissed && step === 'entry' && isWizardDraft(savedDraft?.draft)
    ? savedDraft!.draft as WizardDraft
    : null

  // ── Solve ─────────────────────────────────────────────────────────────────────

  async function runSolve() {
    setIsSolving(true)
    setSolverResult(null)
    let candidates = [
      ...deckIngredients
        .filter(d => d.linkedIngredientId && d.status !== 'skipped')
        .map(d => ({
          ingredientId: d.linkedIngredientId!,
          minPct: parseFloat(d.minPct) || 0,
          maxPct: parseFloat(d.maxPct) || 100,
          nutrients: d.nutrients.map(n => ({ name: n.name, amountPer100g: n.amountPer100g })),
        })),
      ...extraCandidates.map(c => ({
        ingredientId: c.ingredientId,
        minPct: parseFloat(c.minPct) || 0,
        maxPct: parseFloat(c.maxPct) || 100,
        nutrients: c.nutrients.map(n => ({ name: n.name, amountPer100g: n.amountPer100g })),
      })),
    ]
    const activeTargets = targets.filter(t => t.nutrientName && t.value !== '' && parseFloat(t.value) >= 0)

    if (candidates.length === 0) { toast.error('No linked ingredients to solve with'); setIsSolving(false); return }
    if (activeTargets.length === 0) { toast.error('No nutrient targets set'); setIsSolving(false); return }

    // Normalise bounds so the LP is always feasible from a bounds perspective.
    // If max% sum < 100 the solver can never reach 100% — scale up proportionally.
    // If min% sum > 100 the solver is over-constrained from below — scale down.
    const maxSum = candidates.reduce((s, c) => s + c.maxPct, 0)
    if (maxSum < 100) {
      const scale = 120 / maxSum   // target 120% headroom
      candidates = candidates.map(c => ({ ...c, maxPct: Math.min(100, c.maxPct * scale) }))
    }
    const minSum = candidates.reduce((s, c) => s + c.minPct, 0)
    if (minSum > 100) {
      const scale = 80 / minSum    // scale down to 80% of 100
      candidates = candidates.map(c => ({ ...c, minPct: c.minPct * scale }))
    }

    try {
      const r = await fetch(`/api/formulations/${formulationId}/reverse-solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetNutrients: activeTargets.map(t => ({
            name: t.nutrientName, value: parseFloat(t.value), unit: t.unit,
          })),
          candidates,
          servingSizeG: labelServingG ? parseFloat(labelServingG) : null,
        }),
      })
      const data: SolverResult = await r.json()
      setSolverResult(data)
      if (data.status === 'optimal') toast.success(`Solution found in ${data.solveTimeMs}ms`)
      else toast.error(data.message ?? 'No solution found')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setIsSolving(false)
    }
  }

  function applyResult() {
    if (!solverResult || solverResult.status !== 'optimal') return
    const batch = parseFloat(batchSizeG) || 1000

    // All linked deck ingredients must appear regardless of solver pct — they are
    // declared on the label so they must be in the formulation.
    const deckLines = deckIngredients
      .filter(d => d.linkedIngredientId && d.status !== 'skipped')
      .map(d => ({
        ingredientId: d.linkedIngredientId!,
        name: d.linkedIngredientName!,
        verification: 'linked',
        nutrients: d.nutrients,
        isDeckItem: true,
      }))

    // Extra candidates only appear if the solver assigned them ≥ 0.05%
    const extraLines = extraCandidates
      .filter(c => (solverResult.suggestedPcts[c.ingredientId] ?? 0) >= 0.05)
      .map(c => ({
        ingredientId: c.ingredientId,
        name: c.name,
        verification: c.verification,
        nutrients: c.nutrients,
        isDeckItem: false,
      }))

    const allLines = [...deckLines, ...extraLines]

    // The wizard's work is done; a saved draft would only offer to redo it
    if (savedDraft?.draft || lastSavedAt) {
      void fetch(`/api/formulations/${formulationId}/reverse-draft`, { method: 'DELETE' })
        .then(() => queryClient.invalidateQueries({ queryKey: draftKey }))
    }

    onApply(allLines.map((c, i) => ({
      key: c.ingredientId,
      ingredientId: c.ingredientId,
      ingredientName: c.name,
      ingredientVerification: c.verification,
      position: i + 1,
      weightG: Math.round(((solverResult.suggestedPcts[c.ingredientId] ?? 0) / 100) * batch * 10) / 10,
      locked: false,
      nutrients: c.nutrients,
    })))
  }

  // ── Target row helpers ────────────────────────────────────────────────────────

  function updateTarget(id: string, patch: Partial<TargetRow>) {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  function changeNutrient(id: string, name: string) {
    const n = allNutrients?.find(n => n.name === name)
    updateTarget(id, { nutrientName: name, unit: n?.unit ?? 'g' })
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const linkedCount  = deckIngredients.filter(d => d.status !== 'unlinked' && d.status !== 'skipped').length
  const totalDeck    = deckIngredients.length
  const activeTargets = targets.filter(t => t.nutrientName && t.value !== '' && parseFloat(t.value) >= 0)
  const allCandidatesForSolve = [
    ...deckIngredients.filter(d => d.linkedIngredientId && d.status !== 'skipped'),
    ...extraCandidates,
  ]

  function statusIcon(s: string) {
    if (s === 'satisfied') return <span data-tip="Within 1% of the label value."><CheckCircle2 size={13} className="text-green-500" /></span>
    if (s === 'violated')  return <span data-tip="More than 5% off the label value."><XCircle size={13} className="text-red-500" /></span>
    if (s === 'binding')   return <span data-tip="Within 1–5% of the label value."><AlertCircle size={13} className="text-yellow-500" /></span>
    return <span className="text-gray-300 text-xs" data-tip="None of the linked ingredients has data for this nutrient.">—</span>
  }

  // ── Link-step pieces (desktop row and phone dialog share them) ─────────────────

  function renderUrlPanel(d: DeckIngredient) {
    const ls = deckLinkStates[d.id] ?? defaultLinkState()
    return (
      <div className="mt-1 bg-white border border-gray-200 rounded-lg overflow-hidden z-30 relative">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5"><Globe size={11} /> Link via web URL</span>
          <button onClick={() => setUrlPanelOpenId(null)} aria-label="Close" data-tip="Closes the web URL panel." className="p-1 -m-1"><X size={12} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-2.5 space-y-2.5">
          {/* Search row */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={ls.webSearchQuery || d.rawName}
              onChange={e => updateLinkState(d.id, { webSearchQuery: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') webSearchIngredient(d.id, ls.webSearchQuery || d.rawName) }}
              placeholder={d.rawName}
              className="flex-1 min-w-0 px-2 py-2 sm:py-1 text-base sm:text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={() => webSearchIngredient(d.id, ls.webSearchQuery || d.rawName)}
              data-tip={TIP.webSearch}
              disabled={ls.isWebSearching}
              className="flex items-center gap-1 px-3 sm:px-2 py-2 sm:py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {ls.isWebSearching ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Globe size={10} />}
              Search
            </button>
          </div>
          {ls.webSearchError && <p className="text-xs text-red-500">{ls.webSearchError}</p>}
          {ls.webSearchResults.length > 0 && (
            <div className="space-y-1">
              {ls.webSearchResults.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 p-1.5 border border-gray-100 rounded hover:border-blue-200 hover:bg-blue-50/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{r.title}</p>
                    <p className="text-[10px] text-blue-500 truncate">{r.url}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" data-tip={TIP.openPage}
                      className="flex items-center gap-0.5 px-2 sm:px-1.5 py-1.5 sm:py-0.5 text-xs sm:text-[10px] border border-gray-200 rounded hover:bg-gray-50 text-gray-500">
                      <ExternalLink size={8} /> Open
                    </a>
                    <button
                      onClick={() => fetchUrlNutrition(d.id, r.url)}
                      data-tip={TIP.fetch}
                      disabled={ls.isFetchingUrl}
                      className="flex items-center gap-0.5 px-2 sm:px-1.5 py-1.5 sm:py-0.5 text-xs sm:text-[10px] border border-violet-200 rounded hover:bg-violet-50 text-violet-600 disabled:opacity-50">
                      <Sparkles size={8} /> Fetch
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* URL paste */}
          <div className="flex gap-1.5 border-t border-gray-100 pt-2">
            <input
              type="url"
              value={ls.customUrl}
              onChange={e => updateLinkState(d.id, { customUrl: e.target.value, fetchedNutrients: null, fetchError: null })}
              onKeyDown={e => { if (e.key === 'Enter' && ls.customUrl) fetchUrlNutrition(d.id) }}
              placeholder="https://..."
              className="flex-1 min-w-0 px-2 py-2 sm:py-1 text-base sm:text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={() => fetchUrlNutrition(d.id)}
              data-tip={ls.customUrl ? TIP.fetch : 'Paste a URL first.'}
              disabled={!ls.customUrl || ls.isFetchingUrl}
              className="flex items-center gap-1 px-3 sm:px-2 py-2 sm:py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {ls.isFetchingUrl ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={10} />}
              Fetch
            </button>
          </div>
          {ls.fetchError && <p className="text-xs text-red-500">{ls.fetchError}</p>}
          {ls.fetchedNutrients && ls.fetchedNutrients.length > 0 && (
            <div className="space-y-1.5">
              <div className="border border-green-100 rounded overflow-hidden">
                <div className="bg-green-50 px-2 py-1 border-b border-green-100 text-xs font-medium text-green-700">Extracted · <Term t="per100g">per 100 g</Term></div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {ls.fetchedNutrients.map((n, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-gray-700">{n.name}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-gray-600 font-medium">{n.amountPer100g} {n.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => saveExternalLink(d.id, 'url')}
                data-tip={TIP.saveLink}
                disabled={ls.isLinking}
                className="flex items-center gap-1 px-3 py-2 sm:py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors">
                {ls.isLinking ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={11} />}
                Save & Link
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Whichever link panel is open for this item
  function renderLinkPanels(d: DeckIngredient) {
    return (
      <>
        {linkSearchOpenId === d.id && (
          <LibraryLinkSearch
            onLink={(ingId, name, nutrients) => linkDeckItem(d.id, ingId, name, nutrients, 'library')}
            onClose={() => setLinkSearchOpenId(null)}
          />
        )}
        {urlPanelOpenId === d.id && renderUrlPanel(d)}
        {newPanelOpenId === d.id && (
          <NewLibraryIngredientPanel
            rawName={d.rawName}
            onClose={() => setNewPanelOpenId(null)}
            onLinkExisting={e => {
              setNewPanelOpenId(null)
              linkLibraryIngredient(d.id, e.id, name => `Linked to "${name}" from your library`)
            }}
            onCreated={c => {
              linkDeckItem(d.id, c.ingredientId, c.ingredientName, c.nutrients, 'library')
              setNewPanelOpenId(null)
              toast.success(`Added "${c.ingredientName}" to the library and linked it`)
            }}
          />
        )}
      </>
    )
  }

  function renderStatusBadges(d: DeckIngredient) {
    return (
      <>
        {d.subIngredients.length > 0 && (
          <span className="text-[10px] text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full" data-tip={TIP.blend}>blend</span>
        )}
        {d.status === 'library' && (
          <span className="text-xs text-green-600 flex items-center gap-0.5" data-tip="Linked to an ingredient in your library; its nutrition data is used.">
            <CheckCircle2 size={11} /> library
          </span>
        )}
        {d.status === 'usda' && (
          <span
            className="text-xs text-blue-600 flex items-center gap-0.5"
            data-tip="Linked to a new library ingredient made from USDA, a web page, a document or typed-in values."
          >
            <Database size={11} /> USDA
          </span>
        )}
        {d.status === 'skipped' && <span className="text-xs text-gray-400" data-tip={TIP.skip}>skipped</span>}
      </>
    )
  }

  function openUsdaFor(d: DeckIngredient) {
    setUsdaTargetId(d.id); setUsdaQuery(d.rawName); setUsdaOpen(true)
  }

  // The phone dialog for one ingredient: status, bounds, every way to link it, and the open panel
  function renderLinkSheetBody(d: DeckIngredient) {
    const linked = d.status === 'library' || d.status === 'usda'
    const big = 'flex items-center justify-center gap-1.5 px-3 py-3 text-sm border rounded-lg'
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {renderStatusBadges(d)}
          {d.status === 'unlinked' && <span className="text-xs text-gray-400">Not linked yet</span>}
          {d.parentBlendName && <span className="text-xs text-violet-600">in {d.parentBlendName}</span>}
        </div>
        {d.linkedIngredientName && (
          <p className="text-sm text-gray-700">Linked to <span className="font-medium">{d.linkedIngredientName}</span></p>
        )}
        {linked && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1"><Term tip={TIP.bounds}>Usage bounds</Term> for the solver (%)</p>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="decimal" min="0" max="100" step="any" aria-label="Minimum %"
                value={d.minPct} onChange={e => updateBound(d.id, 'minPct', e.target.value)} placeholder="min"
                className="w-full px-3 py-2.5 text-base border border-gray-200 rounded-lg tabular-nums"
              />
              <span className="text-gray-300">–</span>
              <input
                type="number" inputMode="decimal" min="0" max="100" step="any" aria-label="Maximum %"
                value={d.maxPct} onChange={e => updateBound(d.id, 'maxPct', e.target.value)} placeholder="max"
                className="w-full px-3 py-2.5 text-base border border-gray-200 rounded-lg tabular-nums"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </div>
        )}
        {d.status === 'unlinked' ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => togglePanel(d.id, 'library')} data-tip={TIP.library} className={`${big} border-gray-200 text-gray-700 ${linkSearchOpenId === d.id ? 'bg-gray-100' : ''}`}>
              <Link2 size={15} /> Library
            </button>
            <button onClick={() => openUsdaFor(d)} data-tip={TIP.usda} className={`${big} border-blue-200 text-blue-600`}>
              <Database size={15} /> USDA
            </button>
            <button onClick={() => togglePanel(d.id, 'url')} data-tip={TIP.url} className={`${big} border-violet-200 text-violet-600 ${urlPanelOpenId === d.id ? 'bg-violet-50' : ''}`}>
              <Globe size={15} /> Web URL
            </button>
            <button onClick={() => togglePanel(d.id, 'new')} data-tip={TIP.addNew} className={`${big} border-green-200 text-green-700 ${newPanelOpenId === d.id ? 'bg-green-50' : ''}`}>
              <PackagePlus size={15} /> Add new
            </button>
            <button onClick={() => skipDeckItem(d.id)} data-tip={TIP.skip} className={`${big} col-span-2 border-gray-100 text-gray-400`}>
              Skip this ingredient
            </button>
          </div>
        ) : (
          <button
            onClick={() => unlinkDeckItem(d.id)}
            data-tip={d.status === 'skipped' ? TIP.unskip : TIP.unlink}
            className={`${big} w-full border-gray-200 text-gray-500`}>
            <Unlink size={15} /> {d.status === 'skipped' ? 'Undo skip' : 'Unlink'}
          </button>
        )}
        {renderLinkPanels(d)}
      </div>
    )
  }

  // Phone list row: tap to open the ingredient's dialog
  function renderMobileRow(d: DeckIngredient, idx: number, ids: string[]) {
    const linked = d.status === 'library' || d.status === 'usda'
    return (
      <button
        key={d.id}
        onClick={() => openSheet(ids, d.id)}
        className={`w-full text-left rounded-lg border p-3 flex items-center gap-2 ${d.parentBlendName ? 'ml-3 w-[calc(100%-0.75rem)] ' : ''}${
          linked ? 'border-green-200 bg-green-50/40' : d.status === 'skipped' ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200'
        }`}
      >
        <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}.</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{d.rawName}</span>
            {renderStatusBadges(d)}
          </span>
          {d.linkedIngredientName && <span className="block text-xs text-gray-500 truncate">→ {d.linkedIngredientName}</span>}
          {linked && <span className="block text-xs text-gray-400">{d.minPct || 0}–{d.maxPct || 100}%</span>}
          {d.status === 'unlinked' && <span className="block text-xs text-violet-600">Tap to link</span>}
        </span>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </button>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-violet-600 flex items-center justify-center">
            <FlaskConical size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Reverse-engineer wizard</h2>
            <p className="text-xs text-gray-400 truncate">{productName || 'New reverse formulation'}</p>
          </div>
          {/* On phones the draft and close buttons sit beside the title */}
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={saveDraft}
              disabled={step === 'entry' || isSavingDraft}
              data-tip={step === 'entry' ? 'Choose how to start first; there’s nothing to save yet.' : TIP.saveDraft}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 disabled:opacity-40"
            >
              <Save size={13} /> {isSavingDraft ? 'Saving…' : 'Save draft'}
            </button>
            <button onClick={requestClose} aria-label="Close wizard" data-tip={TIP.close} className="p-2 text-gray-400"><X size={18} /></button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StepDots step={step} />
          <div className="hidden sm:flex items-center gap-3">
            {lastSavedAt && !hasUnsavedProgress && (
              <span className="text-xs text-gray-400 whitespace-nowrap">
                Saved {lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={saveDraft}
              disabled={step === 'entry' || isSavingDraft}
              data-tip={step === 'entry' ? 'Choose how to start first; there’s nothing to save yet.' : TIP.saveDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
            >
              <Save size={12} /> {isSavingDraft ? 'Saving…' : 'Save as draft'}
            </button>
            <button onClick={requestClose} aria-label="Close wizard" data-tip={TIP.close} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8">

        {/* ══ STEP: ENTRY ══════════════════════════════════════════════════════ */}
        {step === 'entry' && (
          <div className="space-y-6">
            {resumableDraft && (
              <div className="p-4 rounded-xl border border-violet-200 bg-violet-50 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">You have a saved draft</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {resumableDraft.productName || 'Untitled product'}
                    {' · '}{STEPS.find(s => s.key === resumableDraft.step)?.label}
                    {' · '}{resumableDraft.deckIngredients.filter(d => d.status === 'library' || d.status === 'usda').length}
                    /{resumableDraft.deckIngredients.length} ingredients linked
                    {savedDraft?.savedAt && <> · saved {new Date(savedDraft.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => (confirmDiscard ? discardDraft() : setConfirmDiscard(true))}
                    data-tip={confirmDiscard
                      ? 'Click again to permanently delete the saved draft.'
                      : 'Deletes the saved draft so you can start over. You’re asked to confirm.'}
                    className={`flex-1 sm:flex-none px-4 py-2 text-sm border rounded-md ${
                      confirmDiscard ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {confirmDiscard ? 'Delete draft?' : 'Discard'}
                  </button>
                  <button
                    onClick={() => restoreDraft(resumableDraft, savedDraft?.savedAt ?? null)}
                    data-tip="Reopens the wizard at the step you saved, with everything you entered and found."
                    className="flex-1 sm:flex-none px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700"
                  >
                    Resume
                  </button>
                </div>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">How would you like to start?</h3>
              <p className="text-sm text-gray-500">
                Upload the competitor product label for AI-assisted extraction, or enter the information manually.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => { setMode('image'); setStep('label') }}
                className="flex flex-col items-center gap-3 p-8 border-2 border-gray-200 rounded-xl
                           hover:border-violet-400 hover:bg-violet-50 transition-all group"
              >
                <ImageIcon size={32} className="text-gray-300 group-hover:text-violet-500 transition-colors" />
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-800">Upload product label</div>
                  <div className="text-xs text-gray-400 mt-1">
                    AI extracts nutrients, ingredients, and claims from a photo
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setMode('manual'); setStep('label') }}
                className="flex flex-col items-center gap-3 p-8 border-2 border-gray-200 rounded-xl
                           hover:border-violet-400 hover:bg-violet-50 transition-all group"
              >
                <FileText size={32} className="text-gray-300 group-hover:text-violet-500 transition-colors" />
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-800">Enter manually</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Type nutrients, ingredient deck, and claims yourself
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: LABEL ══════════════════════════════════════════════════════ */}
        {step === 'label' && (
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-gray-900">
              {mode === 'image' ? 'Upload & parse label' : 'Enter product information'}
            </h3>

            {/* ── Image upload (image mode only) ── */}
            {mode === 'image' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { onFilesSelect(Array.from(e.target.files ?? [])); e.target.value = '' }}
                />
                <p className="text-xs text-gray-400">
                  Upload 1–{MAX_IMAGES} photos — e.g. product label, nutrition panel, ingredient deck.
                </p>

                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative w-28 h-28 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Label photo ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                        <button
                          onClick={() => removeImage(i)}
                          aria-label="Remove photo"
                          data-tip="Removes this photo. Values already read from it stay."
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 shadow-sm"
                        >
                          <X size={11} />
                        </button>
                        <p className="text-[10px] text-gray-400 mt-1 truncate">{imageFiles[i]?.name}</p>
                      </div>
                    ))}
                  </div>
                )}

                {imagePreviews.length < MAX_IMAGES && (
                  <div
                    onDrop={onDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-200
                               rounded-xl hover:border-violet-400 hover:bg-violet-50/30 cursor-pointer transition-all"
                  >
                    <Upload size={24} className="text-gray-300" />
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600">
                        {imagePreviews.length === 0 ? 'Drop images here or click to browse' : 'Add another photo'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — up to 12 MB each</div>
                    </div>
                  </div>
                )}

                {imagePreviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={parseLabel}
                      data-tip="AI reads the photos for the product name, serving size, nutrition panel, ingredients and claims. Replaces those fields below."
                      disabled={isParsing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm
                                 rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      {isParsing
                        ? <><div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" /> Parsing…</>
                        : <><Sparkles size={13} /> Parse with AI</>
                      }
                    </button>
                    {productName && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Parsed: <strong>{productName}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Product info ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Product name</label>
                <input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="e.g. Premier Protein Bar — Chocolate"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block"><Term t="servingSize">Serving size</Term> (g)</label>
                  <input
                    type="number" min="0" step="any"
                    value={labelServingG}
                    onChange={e => setLabelServingG(e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    <Term tip="The batch weight the result is scaled to when it’s applied to the formulation. It doesn’t change the percentages.">Batch to produce</Term> (g)
                  </label>
                  <input
                    type="number" min="1" step="any"
                    value={batchSizeG}
                    onChange={e => setBatchSizeG(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* ── Nutrient targets ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">
                  <Term tip="The label’s nutrition values per serving. The solver looks for the percentages that come closest to them.">Nutritional panel</Term> (per serving)
                </label>
                <button
                  onClick={() => setTargets(prev => [...prev, { id: `t${Date.now()}`, nutrientName: '', value: '', unit: 'g' }])}
                  className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
                >
                  <Plus size={11} /> Add nutrient
                </button>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {targets.map(t => (
                  <div key={t.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <select
                      value={t.nutrientName}
                      onChange={e => changeNutrient(t.id, e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="">— nutrient —</option>
                      {allNutrients?.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                    </select>
                    <input
                      type="number" min="0" step="any"
                      value={t.value}
                      onChange={e => updateTarget(t.id, { value: e.target.value })}
                      placeholder="0"
                      className="w-20 px-2 py-1 text-sm border border-gray-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-violet-500 tabular-nums"
                    />
                    <span className="text-xs text-gray-400 w-10">{t.unit}</span>
                    <button onClick={() => setTargets(prev => prev.filter(x => x.id !== t.id))}
                      aria-label="Remove nutrient" data-tip="Removes this nutrient from the targets."
                      className="text-gray-200 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Ingredient deck ── */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                <Term tip="The product’s ingredient list as printed on the label, heaviest first. Blends list their own ingredients in parentheses.">Ingredient deck</Term>{' '}
                {mode === 'manual' ? '(comma or line separated)' : ''}
              </label>
              {mode === 'image' && deckIngredients.length > 0 ? (
                <div className="space-y-1 max-h-36 overflow-y-auto text-sm text-gray-700 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {deckIngredients.map((d, i) => {
                    const prevItem = i > 0 ? deckIngredients[i - 1] : undefined
                    const prevBlend = prevItem?.parentBlendName
                    const prevIsBlendParent = prevItem && prevItem.subIngredients.length > 0 && prevItem.rawName === d.parentBlendName
                    const showBlendHeader = d.parentBlendName && d.parentBlendName !== prevBlend && !prevIsBlendParent
                    return (
                      <div key={d.id}>
                        {showBlendHeader && (
                          <div className="text-xs font-medium text-violet-600 mt-1.5 mb-0.5">
                            {d.parentBlendName} <span className="font-normal text-gray-400">(blend)</span>
                          </div>
                        )}
                        <div className={`flex items-start gap-1.5 text-xs ${d.parentBlendName ? 'ml-3' : ''}`}>
                          <span className="text-gray-400 w-4 shrink-0">{i + 1}.</span>
                          <span>{d.rawName}</span>
                          {d.subIngredients.length > 0 && (
                            <span className="text-violet-500 bg-violet-50 border border-violet-100 px-1 rounded text-[10px]" data-tip={TIP.blend}>blend</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={manualDeckText}
                    onChange={e => setManualDeckText(e.target.value)}
                    placeholder="Whey Protein Isolate, Oats, Almonds, Cocoa Powder, Natural Flavors, Salt"
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                  />
                  <button
                    onClick={applyManualDeck}
                    data-tip="Splits the text at commas and new lines into separate ingredients. Text in parentheses becomes a blend’s ingredients."
                    disabled={!manualDeckText.trim()}
                    className="text-xs text-violet-600 hover:text-violet-700 disabled:opacity-40"
                  >
                    Parse into ingredient list ({parseIngredientDeck(manualDeckText).length} items) →
                  </button>
                </div>
              )}
            </div>

            {/* ── Claims ── */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                <Term tip="Claims printed on the label (vegan, gluten free…). AI research uses them as hints about which ingredients fit.">Label claims</Term>
              </label>
              {claims.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {claims.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full">{c}</span>
                  ))}
                  {impliedConstraints.length > 0 && (
                    <span
                      className="ml-1 text-xs text-gray-400"
                      data-tip="Rules the AI inferred from the claims (e.g. no dairy for “vegan”). They’re passed on to AI research."
                    >
                      {impliedConstraints.length} constraint(s) identified
                    </span>
                  )}
                </div>
              ) : (
                <input
                  value={claims.join(', ')}
                  onChange={e => setClaims(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Vegan, Gluten Free, Non-GMO…"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('entry')}
                className="flex items-center gap-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:bg-gray-50">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => {
                  if (mode === 'manual' && manualDeckText.trim() && deckIngredients.length === 0) applyManualDeck()
                  setStep('link')
                }}
                disabled={activeTargets.length === 0}
                data-tip={activeTargets.length === 0 ? 'Enter at least one nutrient value first.' : undefined}
                className="flex items-center gap-1 px-5 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-40"
              >
                Next: link ingredients <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: LINK ═══════════════════════════════════════════════════════ */}
        {step === 'link' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900"><Term tip={TIP.link}>Link</Term> ingredients to your library</h3>
                <p className="text-sm text-gray-500">
                  Connect each label ingredient to a library or USDA record so the solver has nutrient data.
                  If the lab has it but the library doesn't, add it with “New”.
                </p>
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {linkedCount}/{totalDeck} linked
              </span>
            </div>

            {deckIngredients.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                <Database size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No ingredients in deck — go back and add some.</p>
              </div>
            )}

            {deckIngredients.length > 0 && (
              <div className="space-y-2">
                {deckIngredients.flatMap((d, idx) => {
                  const prevItem = idx > 0 ? deckIngredients[idx - 1] : undefined
                  const prevBlend = prevItem?.parentBlendName
                  const prevIsBlendParent = prevItem && prevItem.subIngredients.length > 0 && prevItem.rawName === d.parentBlendName
                  const showBlendHeader = d.parentBlendName && d.parentBlendName !== prevBlend && !prevIsBlendParent
                  return [
                    showBlendHeader && (
                      <div key={`hdr-${d.id}`} className="flex items-center gap-2 pt-1 pb-0.5">
                        <span className="text-xs font-semibold text-violet-700">{d.parentBlendName}</span>
                        <span className="text-[10px] text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full" data-tip={TIP.blend}>blend</span>
                        <div className="flex-1 h-px bg-violet-100" />
                      </div>
                    ),
                    isMobile ? renderMobileRow(d, idx, deckIngredients.map(x => x.id)) :
                    <div key={d.id} className={`rounded-lg border p-3 transition-colors ${d.parentBlendName ? 'ml-4 ' : ''}${
                      d.status === 'library' || d.status === 'usda' ? 'border-green-200 bg-green-50/40' :
                      d.status === 'skipped'  ? 'border-gray-100 bg-gray-50 opacity-60' :
                                                'border-gray-200'
                    }`}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-400 w-5 shrink-0 pt-0.5">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{d.rawName}</span>
                          {renderStatusBadges(d)}
                        </div>

                        {/* Linked name */}
                        {d.linkedIngredientName && (
                          <p className="text-xs text-gray-500 mt-0.5">→ {d.linkedIngredientName}</p>
                        )}

                        {/* Bounds (shown when linked) */}
                        {(d.status === 'library' || d.status === 'usda') && (
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-gray-400"><Term tip={TIP.bounds}>Bounds</Term>:</span>
                            <input
                              type="number" min="0" max="100" step="any"
                              value={d.minPct}
                              onChange={e => updateBound(d.id, 'minPct', e.target.value)}
                              placeholder="min %"
                              aria-label="Minimum %"
                              className="w-16 px-1.5 py-0.5 text-xs border border-gray-200 rounded tabular-nums"
                            />
                            <span className="text-xs text-gray-300">–</span>
                            <input
                              type="number" min="0" max="100" step="any"
                              value={d.maxPct}
                              onChange={e => updateBound(d.id, 'maxPct', e.target.value)}
                              placeholder="max %"
                              aria-label="Maximum %"
                              className="w-16 px-1.5 py-0.5 text-xs border border-gray-200 rounded tabular-nums"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}

                        {renderLinkPanels(d)}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {d.status === 'unlinked' ? (
                          <>
                            <button
                              onClick={() => togglePanel(d.id, 'library')}
                              data-tip={TIP.library}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600"
                            >
                              <Link2 size={11} /> Library
                            </button>
                            <button
                              onClick={() => openUsdaFor(d)}
                              data-tip={TIP.usda}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-blue-200 rounded hover:bg-blue-50 text-blue-600"
                            >
                              <Database size={11} /> USDA
                            </button>
                            <button
                              onClick={() => togglePanel(d.id, 'url')}
                              data-tip={TIP.url}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-violet-200 rounded hover:bg-violet-50 text-violet-600"
                            >
                              <Globe size={11} /> URL
                            </button>
                            <button
                              onClick={() => togglePanel(d.id, 'new')}
                              data-tip={TIP.addNew}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-green-200 rounded hover:bg-green-50 text-green-700"
                            >
                              <PackagePlus size={11} /> New
                            </button>
                            <button
                              onClick={() => skipDeckItem(d.id)}
                              data-tip={TIP.skip}
                              className="px-2 py-1 text-xs border border-gray-100 rounded hover:bg-gray-50 text-gray-400"
                            >
                              Skip
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => unlinkDeckItem(d.id)}
                            aria-label={d.status === 'skipped' ? 'Undo skip' : 'Unlink'}
                            data-tip={d.status === 'skipped' ? TIP.unskip : TIP.unlink}
                            className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-400"
                          >
                            <Unlink size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>,
                  ].filter(Boolean)
                })}
              </div>
            )}

            {/* Extra candidates */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Add <Term tip="Library ingredients the label doesn’t list that the solver may also use. They’re only added if it gives them a share.">extra candidates</Term> (beyond the declared deck)
              </p>
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
                  <Search size={13} className="text-gray-400 shrink-0" />
                  <input
                    value={extraSearchQuery}
                    onChange={e => setExtraSearchQuery(e.target.value)}
                    placeholder="Search library for additional candidates…"
                    className="flex-1 text-sm outline-none text-gray-700"
                  />
                </div>
                {extraSearchResults.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg">
                    {extraSearchResults.map(ing => (
                      <button
                        key={ing.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => addExtraCandidate(ing)}
                        data-tip="Adds this ingredient as an extra candidate for the solver."
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50"
                      >
                        <LibraryHitLabel ing={ing} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {extraCandidates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extraCandidates.map(c => (
                    <span key={c.ingredientId} className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
                      {c.name}
                      <button
                        onClick={() => setExtraCandidates(prev => prev.filter(x => x.ingredientId !== c.ingredientId))}
                        aria-label={`Remove ${c.name}`}
                        data-tip="Removes this extra candidate."
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('label')}
                className="flex items-center gap-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:bg-gray-50">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep('research')}
                disabled={allCandidatesForSolve.length === 0}
                data-tip={allCandidatesForSolve.length === 0
                  ? 'Link at least one ingredient, or add an extra candidate, first.'
                  : 'AI suggests the product category, likely % ranges and sources for unlinked ingredients. Check its results.'}
                className="flex items-center gap-1 px-5 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-40"
              >
                <Sparkles size={13} /> Run AI research <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: RESEARCH ═══════════════════════════════════════════════════ */}
        {step === 'research' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles size={16} className="text-violet-500" />
                  <Term tip="Benchtop’s AI estimates the product category, on-hand matches, likely % ranges and data sources. It can be wrong; always check.">AI research</Term> synthesis
                </h3>
                <p className="text-sm text-gray-500">
                  Claude analyzes the product profile and suggests identification, percentages, and formulation notes.
                </p>
              </div>
              {!isResearching && (
                <button
                  onClick={runResearch}
                  data-tip="Runs the AI research again with the current label data and links. Replaces the results and the suggested bounds."
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-600 text-sm rounded-md hover:bg-violet-50"
                >
                  <RotateCcw size={12} /> Re-run
                </button>
              )}
            </div>

            {isResearching && (
              <div className="flex flex-col items-center py-16 gap-4 text-gray-400">
                <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                <p className="text-sm">Claude is analyzing the product profile…</p>
              </div>
            )}

            {!isResearching && !researchResult && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200 space-y-1">
                <p className="text-sm font-medium text-red-700">Research did not complete</p>
                {researchError && (
                  <p className="text-xs text-red-600 font-mono break-all">{researchError}</p>
                )}
                <p className="text-xs text-red-500">Use the Re-run button above to try again.</p>
              </div>
            )}

            {!isResearching && researchResult && (
              <>
                {/* Category + approach */}
                <div className="p-4 bg-violet-50 rounded-lg border border-violet-100 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Product category</span>
                    <span className="text-sm font-medium text-gray-800">{researchResult.productCategory}</span>
                  </div>
                  <p className="text-sm text-gray-600">{researchResult.formulationApproach}</p>
                </div>

                {/* On-hand matches */}
                {(researchResult.onHandMatches?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                      Already <Term t="onHand">on hand</Term> in your lab
                    </h4>
                    <div className="space-y-2">
                      {researchResult.onHandMatches!.map((m, i) => {
                        const deckItem = deckIngredients.find(d => d.rawName === m.rawName)
                        const linkedHere = deckItem?.linkedIngredientId === m.ingredientId
                        return (
                          <div key={i} className="flex items-start gap-2 border border-emerald-100 bg-emerald-50/40 rounded-lg p-3">
                            <div className="flex-1 text-sm">
                              <span className="text-gray-500">{m.rawName}</span>
                              <span className="text-gray-400 mx-1.5">→</span>
                              <span className="font-medium text-gray-800">{m.ingredientName}</span>
                              {m.rationale && <span className="block text-xs text-gray-500 mt-0.5">{m.rationale}</span>}
                            </div>
                            {deckItem && (
                              linkedHere ? (
                                <span className="text-xs text-emerald-700 whitespace-nowrap">Linked</span>
                              ) : (
                                <button
                                  onClick={() => linkLibraryIngredient(deckItem.id, m.ingredientId, name => `Linked to on-hand "${name}"`)}
                                  data-tip={deckItem.status === 'unlinked'
                                    ? 'Links the label ingredient to this on-hand library ingredient.'
                                    : 'Replaces the current link with this on-hand library ingredient.'}
                                  className="px-2 py-1 text-xs border border-emerald-300 rounded text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                                >
                                  {deckItem.status === 'unlinked' ? 'Use this' : 'Use instead'}
                                </button>
                              )
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Ingredient suggestions */}
                {researchResult.ingredientSuggestions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Identification suggestions for unlinked ingredients
                    </h4>
                    <div className="space-y-3">
                      {researchResult.ingredientSuggestions.map((item, i) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            <span className="text-gray-400 text-xs mr-1">Unlinked:</span>
                            {item.rawName}
                          </p>
                          {item.suggestions.map((sug, j) => (
                            <div key={j} className="flex items-start gap-2 mb-1.5 last:mb-0">
                              <div className="flex-1">
                                <span className="text-sm text-gray-800">{sug.ingredient}</span>
                                <span className="text-xs text-gray-400 ml-2">{sug.rationale}</span>
                              </div>
                              <button
                                onClick={() => {
                                  const unlinked = deckIngredients.find(d => d.rawName === item.rawName && d.status === 'unlinked')
                                  if (unlinked) {
                                    setUsdaTargetId(unlinked.id)
                                    setUsdaQuery(sug.searchQuery)
                                    setUsdaOpen(true)
                                  }
                                }}
                                data-tip="Opens a USDA search for this suggestion. The food you pick is added to your library and linked."
                                className="flex items-center gap-1 px-2 py-1 text-xs border border-blue-200 rounded hover:bg-blue-50 text-blue-600 whitespace-nowrap"
                              >
                                <Database size={10} /> Search USDA
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approximate percentages */}
                {researchResult.approximatePercentages.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Estimated % ranges (applied to <Term tip={TIP.bounds}>solver bounds</Term>)
                    </h4>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Ingredient</th>
                          <th className="px-3 py-2 text-center font-medium">Min %</th>
                          <th className="px-3 py-2 text-center font-medium">Max %</th>
                          <th className="px-3 py-2 text-left font-medium">Rationale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {researchResult.approximatePercentages.map((p, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-gray-800">{p.ingredient}</td>
                            <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{p.estimatedMinPct}%</td>
                            <td className="px-3 py-1.5 text-center tabular-nums text-gray-600">{p.estimatedMaxPct}%</td>
                            <td className="px-3 py-1.5 text-xs text-gray-400">{p.rationale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {/* Constraints */}
                {researchResult.constraints.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">
                      <Term tip="Rules the AI thinks the product must follow, from its label and claims. Use them to check the result.">Formulation constraints</Term>
                    </p>
                    <ul className="space-y-1">
                      {researchResult.constraints.map((c, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-2"><span>•</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Additional notes */}
                {researchResult.additionalNotes && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Formulation notes</p>
                    <p className="text-sm text-gray-600">{researchResult.additionalNotes}</p>
                  </div>
                )}
              </>
            )}

            {/* ── Interactive link picker for unlinked ingredients ─────────────── */}
            {!isResearching && deckIngredients.some(d => d.status === 'unlinked') && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={12} />
                  Link remaining ingredients
                  <span className="font-normal normal-case text-gray-400 ml-1">
                    — select a source for each or skip
                  </span>
                </h4>
                {isMobile && (() => {
                  const ids = deckIngredients.filter(d => d.status === 'unlinked').map(d => d.id)
                  return deckIngredients
                    .filter(d => d.status === 'unlinked')
                    .map(d => renderMobileRow(d, deckIngredients.indexOf(d), ids))
                })()}
                {!isMobile && deckIngredients
                  .filter(d => d.status === 'unlinked')
                  .map(item => (
                    <div key={item.id}>
                      <DeckLinkCard
                        item={item}
                        linkState={deckLinkStates[item.id]}
                        onImportCandidate={fdcId => importCandidate(item.id, fdcId, item.rawName)}
                        onFetchUrl={() => fetchUrlNutrition(item.id)}
                        onFetchUrlFrom={url => fetchUrlNutrition(item.id, url)}
                        onWebSearch={query => webSearchIngredient(item.id, query)}
                        onSaveExternal={source => saveExternalLink(item.id, source)}
                        onSkip={() => skipDeckItem(item.id)}
                        onUpdateLinkState={patch => updateLinkState(item.id, patch)}
                        onParseDoc={file => parseDoc(item.id, file)}
                        onAddNew={() => togglePanel(item.id, 'new')}
                      />
                      {newPanelOpenId === item.id && renderLinkPanels(item)}
                    </div>
                  ))
                }
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep('link')}
                className="flex items-center gap-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:bg-gray-50">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => setStep('solve')}
                disabled={isResearching || allCandidatesForSolve.length === 0}
                data-tip={isResearching
                  ? 'Wait for the research to finish.'
                  : allCandidatesForSolve.length === 0
                    ? 'Link at least one ingredient first.'
                    : 'Goes to the solver. Ingredients that are still unlinked are left out.'}
                className="flex items-center gap-1 px-5 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-40"
              >
                Proceed to solve <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: SOLVE ══════════════════════════════════════════════════════ */}
        {step === 'solve' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Zap size={16} className="text-violet-500" />{' '}
                <Term tip="A linear-programming solver: it finds the percentages, within each ingredient’s bounds, whose nutrition comes closest to the label.">LP Solver</Term>
              </h3>
              <p className="text-sm text-gray-500">
                {allCandidatesForSolve.length} ingredient{allCandidatesForSolve.length !== 1 ? 's' : ''} available
                · {activeTargets.length} nutrient target{activeTargets.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Candidate summary */}
            <div className="flex flex-wrap gap-1.5">
              {allCandidatesForSolve.map(c => {
                const name = 'linkedIngredientName' in c ? (c as DeckIngredient).linkedIngredientName! : (c as ExtraCandidate).name
                return (
                  <span key={'linkedIngredientId' in c ? (c as DeckIngredient).linkedIngredientId! : (c as ExtraCandidate).ingredientId}
                    className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {name}
                  </span>
                )
              })}
            </div>

            {!solverResult && (
              <button
                onClick={runSolve}
                disabled={isSolving || allCandidatesForSolve.length === 0}
                data-tip="Finds the percentages within each ingredient’s bounds whose nutrition comes closest to the label."
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                {isSolving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Solving…</>
                  : <><Zap size={14} /> Run solver</>
                }
              </button>
            )}

            {solverResult && (
              <>
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span
                    data-tip={solverResult.status === 'optimal'
                      ? 'A best-fit mix was found within the bounds.'
                      : solverResult.status === 'infeasible'
                        ? 'No mix fits the bounds. Widen the bounds or link more ingredients.'
                        : 'The solver failed. Try again.'}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${
                    solverResult.status === 'optimal'    ? 'bg-green-100 text-green-700' :
                    solverResult.status === 'infeasible' ? 'bg-red-100 text-red-700' :
                                                           'bg-gray-100 text-gray-600'
                  }`}>{solverResult.status}</span>
                  {solverResult.status === 'optimal' && (
                    <span className="text-xs text-gray-400">{solverResult.solveTimeMs}ms</span>
                  )}
                  <button
                    onClick={() => { setSolverResult(null); runSolve() }}
                    data-tip="Runs the solver again, e.g. after changing bounds or links on earlier steps."
                    className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600"
                  >
                    <RotateCcw size={11} /> Re-solve
                  </button>
                </div>

                {solverResult.status !== 'optimal' && (
                  <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">{solverResult.message}</p>
                )}
                {/* A note on an optimal result, e.g. targets skipped for a unit that can't be converted */}
                {solverResult.status === 'optimal' && solverResult.message && (
                  <p className="text-sm text-amber-800 p-3 bg-amber-50 rounded-lg">{solverResult.message}</p>
                )}

                {solverResult.status === 'optimal' && (() => {
                  const batch = parseFloat(batchSizeG) || 1000
                  const activeCands = allCandidatesForSolve.filter(c => {
                    const id = 'linkedIngredientId' in c ? (c as DeckIngredient).linkedIngredientId! : (c as ExtraCandidate).ingredientId
                    return (solverResult.suggestedPcts[id] ?? 0) >= 0.05
                  })
                  return (
                    <>
                      {/* Suggested blend */}
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Ingredient</th>
                            <th className="px-3 py-2 text-right font-medium"><Term t="usagePct">%</Term></th>
                            <th className="px-3 py-2 text-right font-medium">Weight (g)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {activeCands.map(c => {
                            const id = 'linkedIngredientId' in c ? (c as DeckIngredient).linkedIngredientId! : (c as ExtraCandidate).ingredientId
                            const name = 'linkedIngredientName' in c ? (c as DeckIngredient).linkedIngredientName! : (c as ExtraCandidate).name
                            const pct = solverResult.suggestedPcts[id] ?? 0
                            return (
                              <tr key={id}>
                                <td className="px-3 py-2 text-gray-800 font-medium">{name}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right tabular-nums">{Math.round((pct / 100) * batch * 10) / 10} g</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      </div>

                      {/* Nutrient comparison: label target vs. formulated, per serving */}
                      {solverResult.auditTrace.length > 0 && (() => {
                        const servingG = parseFloat(labelServingG) || null
                        return (
                          <div className="border border-gray-100 rounded-lg overflow-hidden">
                            {/* Panel header */}
                            <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-100">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Nutrient Comparison
                              </span>
                              <span className="text-xs text-gray-400">
                                {servingG ? `Per ${servingG} g serving` : 'Per 100 g'}
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-gray-100">
                                <tr className="text-xs text-gray-500">
                                  <th className="px-3 py-2 text-left font-medium">Nutrient</th>
                                  <th className="px-3 py-2 text-right font-medium">
                                    <Term tip="The value from the label’s nutrition panel.">Label target</Term>
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium">
                                    <Term tip="What the solved recipe gives, per serving (or per 100 g if there’s no serving size).">Formulated</Term>
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium w-16">
                                    <Term tip="Formulated minus label target. Green within 5%, yellow 5–20%, red over 20%.">Δ</Term>
                                  </th>
                                  <th className="px-3 py-2 text-center font-medium w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {solverResult.auditTrace.map((entry, i) => {
                                  // Label's original per-serving value from the targets state
                                  const targetRow = activeTargets.find(t => t.nutrientName === entry.label)
                                  // …in the audit's unit (the nutrient's own), which the label may not use
                                  const labelVal = targetRow
                                    ? convertToUnit(parseFloat(targetRow.value), targetRow.unit, entry.unit)
                                    : null

                                  // Convert achieved (per 100 g) to per serving
                                  const achieved = entry.achieved != null && servingG
                                    ? entry.achieved * servingG / 100
                                    : entry.achieved

                                  const delta = achieved != null && labelVal != null ? achieved - labelVal : null
                                  const absPct = delta != null && labelVal ? Math.abs(delta / labelVal) * 100 : null
                                  const isGood = absPct != null && absPct <= 5
                                  const isWarn = absPct != null && absPct > 5 && absPct <= 20
                                  const isBad  = absPct != null && absPct > 20

                                  return (
                                    <tr key={i} className={
                                      isBad  ? 'bg-red-50' :
                                      isWarn ? 'bg-yellow-50/60' : ''
                                    }>
                                      <td className="px-3 py-2 font-medium text-gray-800">{entry.label}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                        {labelVal != null ? `${labelVal} ${entry.unit}` : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums text-gray-800 font-medium">
                                        {achieved != null ? `${achieved.toFixed(1)} ${entry.unit}` : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                                        {delta != null ? (
                                          <span className={
                                            isGood ? 'text-green-600' :
                                            isWarn ? 'text-yellow-600' : 'text-red-600'
                                          }>
                                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                                          </span>
                                        ) : '—'}
                                      </td>
                                      <td className="px-3 py-2 flex justify-center items-center">
                                        {statusIcon(entry.status)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Apply */}
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-xs text-gray-400">
                          Produces {batch} g batch at declared serving size {labelServingG ? `(${labelServingG} g / serving)` : ''}.
                        </p>
                        <button
                          onClick={applyResult}
                          data-tip="Replaces all the formulation’s ingredients with this result, scaled to the batch. Not saved until you click Save."
                          className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white text-sm rounded-md hover:bg-violet-700"
                        >
                          Apply to formulation
                        </button>
                      </div>
                    </>
                  )
                })()}
              </>
            )}

            <div className="pt-2">
              <button onClick={() => setStep('research')}
                className="flex items-center gap-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-md hover:bg-gray-50">
                <ChevronLeft size={14} /> Back
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Phones: one ingredient at a time (rendered before the USDA dialog so that opens on top) */}
      {isMobile && sheet && (() => {
        const d = deckIngredients.find(x => x.id === sheet.ids[sheet.index])
        if (!d) return null
        return (
          <IngredientSheet
            title={d.rawName}
            subtitle={`Ingredient ${deckIngredients.indexOf(d) + 1} of ${deckIngredients.length}`}
            onClose={() => setSheet(null)}
            onPrev={sheet.index > 0 ? () => moveSheet(-1) : null}
            onNext={sheet.index < sheet.ids.length - 1 ? () => moveSheet(1) : null}
          >
            {step === 'research' && d.status === 'unlinked' ? (
              <div className="space-y-3">
                <DeckLinkCard
                  item={d}
                  linkState={deckLinkStates[d.id]}
                  onImportCandidate={fdcId => importCandidate(d.id, fdcId, d.rawName)}
                  onFetchUrl={() => fetchUrlNutrition(d.id)}
                  onFetchUrlFrom={url => fetchUrlNutrition(d.id, url)}
                  onWebSearch={query => webSearchIngredient(d.id, query)}
                  onSaveExternal={source => saveExternalLink(d.id, source)}
                  onSkip={() => skipDeckItem(d.id)}
                  onUpdateLinkState={patch => updateLinkState(d.id, patch)}
                  onParseDoc={file => parseDoc(d.id, file)}
                  onAddNew={() => togglePanel(d.id, 'new')}
                />
                {renderLinkPanels(d)}
              </div>
            ) : renderLinkSheetBody(d)}
          </IngredientSheet>
        )
      })()}

      {/* Closing with unsaved progress */}
      {closePromptOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Save your progress?">
            <h3 className="text-base font-semibold text-gray-900">Save your progress?</h3>
            <p className="text-sm text-gray-500 mt-1">
              Save a draft to pick up where you left off next time you open the wizard.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={async () => { if (await saveDraft()) { setClosePromptOpen(false); onClose() } }}
                disabled={isSavingDraft}
                className="w-full py-2.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50"
              >
                {isSavingDraft ? 'Saving…' : 'Save draft & close'}
              </button>
              <button
                onClick={() => { setClosePromptOpen(false); onClose() }}
                data-tip="Closes the wizard. Anything since your last draft save is lost."
                className="w-full py-2.5 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
              >
                Close without saving
              </button>
              <button
                onClick={() => setClosePromptOpen(false)}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
              >
                Keep working
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USDA search dialog (used for ingredient linking) */}
      <UsdaSearchDialog
        open={usdaOpen}
        initialQuery={usdaQuery}
        existingNote="linked"
        onClose={() => { setUsdaOpen(false); setUsdaTargetId(null) }}
        onImported={onUsdaImported}
      />
    </div>
  )
}
