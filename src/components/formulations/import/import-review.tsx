'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowLeft, BookOpen, Check, CheckCircle2, Database, Loader2, PenLine, Plus, RotateCcw, Save, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { readErrorMessage } from '@/lib/utils'
import { formatWeightG } from '@/lib/weight'
import { useUnsavedChangesWarning } from '@/lib/use-unsaved-changes-warning'
import {
  IMPORT_UNITS, duplicateIngredients, includedLines, lineGrams, missingInfo, normalizeName, percentTotal,
  type ImportDraft, type ImportLine, type ImportUnit,
} from '@/lib/formulation-import'
import { ClientSelect, useClientOptions } from '@/components/clients/client-select'
import { LibraryPickerDialog } from '@/components/formulations/swap-source-dialog'
import { UsdaSearchDialog } from '@/components/ingredients/usda-search-dialog'
import { AddIngredientDialog } from '@/components/ingredients/add-ingredient-dialog'
import { IMPORTS_KEY } from './use-import-drafts'
import { Term } from '@/components/term'

type ProjectRow = { id: string; name: string; client: string | null; clientId: string | null; canEdit: boolean }

const input = 'px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const btnSmall = 'px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 whitespace-nowrap'

const numOrNull = (s: string) => {
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function Section({ title, hint, children }: { title: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Check and complete a formulation read from a spreadsheet. Missing ingredients, the project and
 * its client can be added here without leaving the page; anything can be skipped for now, but a
 * skipped vital item means the import is only saved as a draft.
 */
export function ImportReview({ initial, importId: initialImportId, canEditLibrary, canCreateProject, onBack }: {
  initial: ImportDraft
  importId: string | null
  canEditLibrary: boolean
  canCreateProject: boolean
  onBack: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ImportDraft>(initial)
  const [importId, setImportId] = useState(initialImportId)
  const [dirty, setDirty] = useState(!initialImportId)
  const confirmLeave = useUnsavedChangesWarning(dirty)

  // Linking one sheet row to the library: choose how, then the matching picker
  const [linking, setLinking] = useState<{ key: string; via: 'choose' | 'library' | 'usda' | 'manual' } | null>(null)
  const [newProject, setNewProject] = useState<{ name: string; clientId: string | null } | null>(null)

  const { data: projects = [] } = useQuery<ProjectRow[]>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then(r => r.json()),
  })
  const editableProjects = projects.filter(p => p.canEdit)
  const { data: clientOptions } = useClientOptions()

  const missing = useMemo(() => missingInfo(draft), [draft])
  const dupes = useMemo(() => duplicateIngredients(draft), [draft])
  const lines = includedLines(draft)
  const totalG = lines.reduce((s, l) => s + (lineGrams(l, draft.batchSizeG) ?? 0), 0)
  const pctTotal = percentTotal(draft)
  const openWithSuggestion = draft.lines.filter(l => l.status === 'open' && l.candidates.length > 0)

  function change(patch: Partial<ImportDraft>) {
    setDraft(d => ({ ...d, ...patch }))
    setDirty(true)
  }
  function changeLine(key: string, patch: Partial<ImportLine>) {
    setDraft(d => ({ ...d, lines: d.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }))
    setDirty(true)
  }

  // Links the row, and any other unlinked row with the same name in the file, to an ingredient
  async function linkIngredient(key: string, id: string, knownName?: string) {
    let name = knownName
    if (!name) {
      const r = await fetch(`/api/ingredients/${id}`)
      if (!r.ok) { toast.error('Could not load that ingredient'); return }
      name = ((await r.json()) as { name: string }).name
    }
    setDraft(d => {
      const raw = normalizeName(d.lines.find(l => l.key === key)?.rawName ?? '')
      return {
        ...d,
        lines: d.lines.map(l =>
          l.key === key || (l.status !== 'matched' && l.status !== 'excluded' && raw && normalizeName(l.rawName) === raw)
            ? { ...l, ingredientId: id, ingredientName: name!, status: 'matched' as const }
            : l),
      }
    })
    setDirty(true)
    setLinking(null)
  }

  function acceptAllSuggestions() {
    setDraft(d => ({
      ...d,
      lines: d.lines.map(l => (l.status === 'open' && l.candidates.length
        ? { ...l, ingredientId: l.candidates[0].id, ingredientName: l.candidates[0].name, status: 'matched' as const }
        : l)),
    }))
    setDirty(true)
  }

  const createProject = useMutation({
    mutationFn: async (p: { name: string; clientId: string | null }) => {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.name.trim(), clientId: p.clientId }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not create the project'))
      return (await r.json()) as { id: string; name: string }
    },
    onSuccess: p => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      change({ project: { ...draft.project, id: p.id, skipped: false } })
      setNewProject(null)
      toast.success(`Project “${p.name}” created`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Adds the client the file names, so the new project can be filed under it
  const createClient = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not add the client'))
      return (await r.json()) as { id: string; name: string }
    },
    onSuccess: c => {
      queryClient.invalidateQueries({ queryKey: ['client-options'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      change({ client: { ...draft.client, id: c.id, skipped: false } })
      setNewProject(p => (p ? { ...p, clientId: c.id } : p))
      toast.success(`Client “${c.name}” added`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveDraft = useMutation({
    mutationFn: async () => {
      const r = await fetch(importId ? `/api/formulation-imports/${importId}` : '/api/formulation-imports', {
        method: importId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not save the draft'))
      return (await r.json()) as { id: string }
    },
    onSuccess: row => {
      setImportId(row.id)
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: IMPORTS_KEY })
      toast.success('Saved as a draft. Finish it from Import formulation on the Projects page.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const commit = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/formulation-imports/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, importId }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not create the formulation'))
      return (await r.json()) as { formulationId: string }
    },
    onSuccess: ({ formulationId }) => {
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: IMPORTS_KEY })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(`“${draft.name}” imported`)
      router.push(`/formulations/${formulationId}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const chosenProject = projects.find(p => p.id === draft.project.id)
  const linkingLine = linking ? draft.lines.find(l => l.key === linking.key) : null
  const complete = missing.vital.length === 0
  const busy = saveDraft.isPending || commit.isPending

  return (
    <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-5xl pb-40">
      <button
        onClick={() => { if (confirmLeave()) onBack() }}
        data-tip="Goes back to the upload screen. Unsaved changes here are lost unless you save a draft first."
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <h1 className="text-2xl font-semibold text-gray-900">Review import</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        From <span className="font-medium text-gray-700">{draft.fileName}</span>{draft.sheet ? `, sheet “${draft.sheet}”` : ''}.
        Check everything below against your file. Add anything missing here, or skip it for now and save a draft.
      </p>

      <div className="space-y-5">
        {draft.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-center gap-1.5 font-medium mb-1"><AlertTriangle size={14} /> Notes from reading the file</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <Section title="Formulation">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="sm:col-span-3 block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-400">*</span></span>
              <input value={draft.name} maxLength={255} onChange={e => change({ name: e.target.value })} className={`${input} w-full`} />
            </label>
            <label className="block" data-tip="How much one serving weighs, in grams. Needed for per-serving nutrition, the Nutrition Facts panel and cost.">
              <span className="block text-xs font-medium text-gray-600 mb-1">Serving size (g) <span className="font-normal text-gray-400">optional</span></span>
              <input
                inputMode="decimal" defaultValue={draft.servingSizeG ?? ''} placeholder="e.g. 40"
                onChange={e => change({ servingSizeG: numOrNull(e.target.value) })} className={`${input} w-full`}
              />
            </label>
            <label
              className="block"
              data-tip="The total weight of all ingredients, in grams. Needed to turn % amounts into grams; otherwise it comes from the amounts."
            >
              <span className="block text-xs font-medium text-gray-600 mb-1">
                Batch size (g){' '}
                {lines.some(l => l.unit === '%')
                  ? <span className="text-red-400">*</span>
                  : <span className="font-normal text-gray-400">from the amounts</span>}
              </span>
              <input
                inputMode="decimal" defaultValue={draft.batchSizeG ?? ''}
                placeholder={lines.some(l => l.unit === '%') ? 'needed for % amounts' : formatWeightG(totalG)}
                onChange={e => change({ batchSizeG: numOrNull(e.target.value) })} className={`${input} w-full`}
              />
            </label>
            <label className="sm:col-span-3 block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="font-normal text-gray-400">optional</span></span>
              <textarea
                rows={2} maxLength={5000} value={draft.notes ?? ''}
                onChange={e => change({ notes: e.target.value || null })} className={`${input} w-full`}
              />
            </label>
          </div>
        </Section>

        <Section
          title={<Term t="project">Project</Term>}
          hint="Every formulation lives in a project. Pick one, create one here, or skip it for now."
        >
          {chosenProject ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <CheckCircle2 size={15} className="text-green-600" />
              <span className="font-medium text-gray-900">{chosenProject.name}</span>
              {chosenProject.client && <span className="text-gray-500">· {chosenProject.client}</span>}
              <button
                className="text-xs text-blue-600 hover:underline ml-1"
                data-tip="Choose a different project, or create one, for this formulation."
                onClick={() => change({ project: { ...draft.project, id: null } })}
              >
                Change
              </button>
            </div>
          ) : newProject ? (
            <form
              className="space-y-3 rounded-md border border-gray-200 p-3"
              onSubmit={e => { e.preventDefault(); if (newProject.name.trim()) createProject.mutate(newProject) }}
            >
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">New project name</span>
                <input autoFocus value={newProject.name} maxLength={255}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })} className={`${input} w-full`} />
              </label>
              <div>
                <span className="block text-xs font-medium text-gray-600 mb-1">
                  <Term t="client">Client</Term> {clientOptions?.canChooseNone !== false && <span className="font-normal text-gray-400">(optional)</span>}
                </span>
                <ClientSelect value={newProject.clientId} onChange={id => setNewProject({ ...newProject, clientId: id })} />
                {draft.client.rawName && !newProject.clientId && !draft.client.skipped && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    The file names the client “{draft.client.rawName}”.
                    {clientOptions?.canManage && (
                      <button type="button" className="text-blue-600 hover:underline" disabled={createClient.isPending}
                        data-tip="Adds this client to your account now and files the new project under it."
                        onClick={() => createClient.mutate(draft.client.rawName!)}>
                        Add “{draft.client.rawName}” as a client
                      </button>
                    )}
                    <button type="button" className="text-gray-500 hover:underline"
                      data-tip="Creates the project without the client named in the file. You can link a client later."
                      onClick={() => change({ client: { ...draft.client, skipped: true } })}>
                      Skip the client
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={!newProject.name.trim() || createProject.isPending ||
                  (clientOptions?.canChooseNone === false && !newProject.clientId)}
                  data-tip={!newProject.name.trim()
                    ? 'Enter a project name first.'
                    : clientOptions?.canChooseNone === false && !newProject.clientId
                      ? 'Choose a client first; your account needs every project to have one.'
                      : 'Creates the project now (it’s kept even if you don’t finish the import) and files this formulation in it.'}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {createProject.isPending ? 'Creating…' : 'Create project'}
                </button>
                <button type="button" onClick={() => setNewProject(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              {draft.project.rawName && (
                <p className="text-sm text-gray-600">
                  The file names the project “{draft.project.rawName}”, which isn’t one of your projects.
                </p>
              )}
              {draft.project.skipped && (
                <p className="text-sm text-amber-700">Skipped for now. The import can only be saved as a draft until it has a project.</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={e => e.target.value && change({ project: { ...draft.project, id: e.target.value, skipped: false } })}
                  aria-label="Project"
                  data-tip="Files the imported formulation in one of your projects. Only projects you can edit are listed."
                  className={`${input} min-w-[14rem]`}
                >
                  <option value="">Choose an existing project…</option>
                  {editableProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.client ? ` (${p.client})` : ''}</option>
                  ))}
                </select>
                {canCreateProject && (
                  <button
                    onClick={() => setNewProject({
                      name: draft.project.rawName ?? draft.name,
                      clientId: draft.client.skipped ? null : draft.client.id,
                    })}
                    data-tip="Opens a short form to create a new project (and pick its client) without leaving the import."
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <Plus size={13} /> {draft.project.rawName ? `Create “${draft.project.rawName}”` : 'New project'}
                  </button>
                )}
                {!draft.project.skipped && (
                  <button
                    onClick={() => change({ project: { ...draft.project, skipped: true } })}
                    data-tip="Leaves the project for later. Until it has one, the import can only be saved as a draft."
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Skip for now
                  </button>
                )}
              </div>
            </div>
          )}
        </Section>

        <Section
          title={`Ingredients (${lines.length})`}
          hint="Link each row to an ingredient in your library. Rows that aren’t ingredients (a total, a note) can be left out."
        >
          {openWithSuggestion.length > 1 && (
            <button
              onClick={acceptAllSuggestions}
              data-tip="Links every unconfirmed row to its closest library match in one go. Check the result."
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <Check size={13} /> Use the first suggestion for all {openWithSuggestion.length} unconfirmed rows
            </button>
          )}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[46rem]">
              <thead className="text-xs text-gray-500 text-left border-b border-gray-100">
                <tr>
                  <th className="font-medium px-3 py-2">In the file</th>
                  <th className="font-medium px-3 py-2 w-48">Amount</th>
                  <th className="font-medium px-3 py-2">In your <Term t="ingredientLibrary">library</Term></th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {draft.lines.map(l => {
                  const excluded = l.status === 'excluded'
                  const grams = lineGrams(l, draft.batchSizeG)
                  return (
                    <tr key={l.key} className={excluded ? 'opacity-50' : l.status === 'matched' ? '' : 'bg-amber-50/40'}>
                      <td className="px-3 py-2 align-top">
                        <div className={`text-gray-900 ${excluded ? 'line-through' : ''}`}>{l.rawName || <i className="text-gray-400">no name</i>}</div>
                        <div className="text-xs text-gray-500">
                          {[l.rawQuantity && `“${l.rawQuantity}”`, l.supplier, l.itemCode && `#${l.itemCode}`, l.note].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-1">
                          <input
                            inputMode="decimal" aria-label={`Amount of ${l.rawName}`} disabled={excluded}
                            defaultValue={l.amount ?? ''}
                            onChange={e => changeLine(l.key, { amount: numOrNull(e.target.value) })}
                            className={`${input} w-24 text-right ${!excluded && !(l.amount && l.unit) ? 'border-red-300' : ''}`}
                          />
                          <select
                            aria-label={`Unit for ${l.rawName}`} disabled={excluded} value={l.unit ?? ''}
                            data-tip="The unit of the amount. % means a share of the batch size; mL, cups or pieces can’t be converted, so use grams."
                            onChange={e => changeLine(l.key, { unit: (e.target.value || null) as ImportUnit | null })}
                            className={`${input} ${!excluded && !l.unit ? 'border-red-300' : ''}`}
                          >
                            <option value="">unit</option>
                            {IMPORT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        {!excluded && l.unit === '%' && grams != null && (
                          <div className="text-xs text-gray-400 mt-0.5">= {formatWeightG(Math.round(grams * 100) / 100)} g</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {excluded ? (
                          <span className="text-xs text-gray-500">Left out</span>
                        ) : l.status === 'matched' ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                            <span className="text-gray-900">{l.ingredientName}</span>
                            <button
                              className="text-xs text-blue-600 hover:underline"
                              data-tip="Link this row to a different ingredient."
                              onClick={() => setLinking({ key: l.key, via: 'choose' })}
                            >
                              Change
                            </button>
                          </div>
                        ) : l.status === 'skipped' ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-amber-700">Skipped — add it later</span>
                            <button
                              className="text-blue-600 hover:underline"
                              data-tip="Link this row to an ingredient in your library, or add a new one."
                              onClick={() => setLinking({ key: l.key, via: 'choose' })}
                            >
                              Link now
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {l.candidates.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-gray-500">
                                  <Term tip="Close matches from your library. Click one to link it; other rows with the same name are linked too.">Did you mean</Term>
                                </span>
                                {l.candidates.slice(0, 3).map(c => (
                                  <button key={c.id} onClick={() => linkIngredient(l.key, c.id, c.name)}
                                    data-tip="Links this row, and any unlinked row with the same name, to this library ingredient."
                                    className="px-2 py-0.5 text-xs rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50">
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-amber-700">Not in your library</span>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                className={btnSmall}
                                data-tip="Choose the ingredient yourself from your library. Rows with the same name are linked too."
                                onClick={() => setLinking({ key: l.key, via: 'library' })}
                              >
                                Pick from library
                              </button>
                              {canEditLibrary && (
                                <button
                                  className={btnSmall}
                                  data-tip="Adds it to your library now, from USDA or by typing its details, and links this row. It stays in the library even if you don’t finish."
                                  onClick={() => setLinking({ key: l.key, via: 'choose' })}
                                >
                                  Add new ingredient
                                </button>
                              )}
                              <button
                                className={btnSmall}
                                data-tip="Leaves this row unlinked for now. The import can then only be saved as a draft."
                                onClick={() => changeLine(l.key, { status: 'skipped' })}
                              >
                                Skip for now
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        {excluded ? (
                          <button data-tip="Brings this row back into the formulation." aria-label={`Include ${l.rawName}`}
                            onClick={() => changeLine(l.key, { status: l.ingredientId ? 'matched' : 'open' })}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded">
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            data-tip="Leaves this row out, for rows that aren’t ingredients (a total, a note). It’s ignored on import."
                            aria-label={`Leave out ${l.rawName}`}
                            onClick={() => changeLine(l.key, { status: 'excluded' })}
                            className="p-1 text-gray-400 hover:text-red-600 rounded">
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 text-xs text-gray-500">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2" colSpan={3}>
                    {formatWeightG(Math.round(totalG * 100) / 100)} g
                    {pctTotal != null && ` · ${Math.round(pctTotal * 100) / 100}% in percentage rows`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {dupes.length > 0 && (
            <p className="text-xs text-gray-500">
              Linked to the same ingredient more than once: {dupes.join(', ')}. Those rows are combined into one line when the formulation is created.
            </p>
          )}
        </Section>

        {draft.steps.length > 0 && (
          <Section title={<Term t="processStep">Process steps</Term>} hint="Optional. Untick a step to leave it out; edit the wording if needed.">
            <ol className="space-y-2">
              {draft.steps.map((s, i) => (
                <li key={s.key} className="flex items-start gap-2">
                  <input
                    type="checkbox" checked={s.included} className="mt-2 rounded border-gray-300" aria-label={`Include step ${i + 1}`}
                    onChange={e => change({ steps: draft.steps.map(x => (x.key === s.key ? { ...x, included: e.target.checked } : x)) })}
                  />
                  <span className="text-xs text-gray-400 mt-2 w-5 shrink-0">{i + 1}.</span>
                  <textarea
                    rows={1} value={s.instruction} maxLength={2000} disabled={!s.included}
                    onChange={e => change({ steps: draft.steps.map(x => (x.key === s.key ? { ...x, instruction: e.target.value } : x)) })}
                    className={`${input} flex-1 disabled:text-gray-400`}
                  />
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>

      {/* What's left, and the two ways to save */}
      <div className="fixed bottom-0 right-0 left-0 sm:left-56 z-30 border-t border-gray-200 bg-white/95 backdrop-blur print:hidden">
        <div className="max-w-5xl px-4 sm:px-8 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[16rem] text-sm">
            {complete ? (
              <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 size={15} /> Ready to create the formulation.</span>
            ) : (
              <span className="text-amber-800">
                <b>Still needed:</b> {missing.vital.join('; ')}. You can save a draft and finish it later.
              </span>
            )}
            {missing.optional.length > 0 && (
              <span className="block text-xs text-gray-500">Optional: {missing.optional.join('; ')}</span>
            )}
          </div>
          <button onClick={() => saveDraft.mutate()} disabled={busy}
            data-tip="Saves your progress as a draft, private to you. It isn’t a formulation until you click Create formulation."
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
            {saveDraft.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {importId && !dirty ? 'Draft saved' : 'Save as draft'}
          </button>
          <button onClick={() => commit.mutate()} disabled={!complete || busy}
            data-tip={complete
              ? 'Creates the formulation as version 1 in the chosen project and opens it.'
              : 'Add the missing information first, or save a draft'}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {commit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Create formulation
          </button>
        </div>
      </div>

      {/* Linking a row: how, then the matching picker */}
      {linking?.via === 'choose' && linkingLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Link ingredient</h2>
              <button onClick={() => setLinking(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Link <span className="font-medium text-gray-700">{linkingLine.rawName}</span> to:
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setLinking({ key: linking.key, via: 'library' })}
                data-tip="Choose an ingredient already in your library."
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-left">
                <BookOpen size={18} className="text-emerald-600 shrink-0" />
                <span><span className="block text-sm font-medium text-gray-900">An ingredient in my library</span></span>
              </button>
              {canEditLibrary && (
                <>
                  <button onClick={() => setLinking({ key: linking.key, via: 'usda' })}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left">
                    <Database size={18} className="text-blue-600 shrink-0" />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">A new ingredient from USDA</span>
                      <span className="block text-xs text-gray-500">Adds it to your library with USDA nutrition data</span>
                    </span>
                  </button>
                  <button onClick={() => setLinking({ key: linking.key, via: 'manual' })}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-400 hover:bg-violet-50 text-left">
                    <PenLine size={18} className="text-violet-600 shrink-0" />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">A new ingredient I enter</span>
                      <span className="block text-xs text-gray-500">Type its details, or read them from a web page</span>
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <LibraryPickerDialog
        open={linking?.via === 'library'}
        excludeId={null}
        onClose={() => setLinking(null)}
        onSelect={id => linking && linkIngredient(linking.key, id)}
      />
      <UsdaSearchDialog
        open={linking?.via === 'usda'}
        initialQuery={linkingLine?.rawName ?? ''}
        existingNote="linked"
        onClose={() => setLinking(null)}
        onImported={id => { if (id && linking) linkIngredient(linking.key, id); else setLinking(null) }}
      />
      <AddIngredientDialog
        open={linking?.via === 'manual'}
        initialName={linkingLine?.rawName ?? ''}
        onClose={() => setLinking(null)}
        onCreated={id => { if (id && linking) linkIngredient(linking.key, id); else setLinking(null) }}
      />
    </div>
  )
}
