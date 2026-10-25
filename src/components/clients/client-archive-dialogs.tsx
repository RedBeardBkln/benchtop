'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { readErrorMessage } from '@/lib/utils'
import { ingredientBlock, supplierBlock, type ClientArchivePlan } from '@/lib/client-archive-plan'
import type { ClientRestorePlan } from '@/lib/client-archive'

type Item = { id: string; label: string; detail?: string; blocked?: string | null }

/** A titled list of checkboxes. Blocked items are shown greyed out with the reason. */
function Checklist({ title, description, items, selected, onChange }: {
  title: string
  description: string
  items: Item[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  if (items.length === 0) return null
  const open = items.filter(i => !i.blocked)
  const allOn = open.length > 0 && open.every(i => selected.has(i.id))
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onChange(next)
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {open.length > 1 && (
          <button type="button" onClick={() => onChange(allOn ? new Set() : new Set(open.map(i => i.id)))}
            className="text-xs text-blue-600 hover:underline shrink-0">
            {allOn ? 'Select none' : 'Select all'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-1.5">{description}</p>
      <ul className="border border-gray-100 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
        {items.map(i => (
          <li key={i.id}>
            <label className={`flex items-start gap-2 px-3 py-2 text-sm ${i.blocked ? 'text-gray-400' : 'text-gray-800 cursor-pointer'}`}>
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                disabled={!!i.blocked}
                checked={!i.blocked && selected.has(i.id)}
                onChange={e => toggle(i.id, e.target.checked)}
              />
              <span className="min-w-0">
                {i.label}
                {(i.blocked || i.detail) && <span className="block text-xs text-gray-400">{i.blocked ?? i.detail}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DialogFrame({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">{footer}</div>
      </div>
    </div>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Archive a client with its projects and formulations, optionally taking ingredients and suppliers nothing else uses. */
export function ArchiveClientDialog({ client, onClose }: { client: { id: string; name: string }; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [ingredientIds, setIngredientIds] = useState<Set<string>>(new Set())
  const [supplierIds, setSupplierIds] = useState<Set<string>>(new Set())

  const { data: plan, isLoading, isError } = useQuery<ClientArchivePlan>({
    queryKey: ['client-archive-plan', client.id],
    queryFn: async () => {
      const r = await fetch(`/api/clients/${client.id}/archive`)
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load'))
      return r.json()
    },
    staleTime: 0,
  })

  const supplierItems: Item[] = (plan?.suppliers ?? []).map(s => ({
    id: s.id,
    label: s.name,
    blocked: supplierBlock(s, plan!.ingredients, ingredientIds),
  }))
  // Suppliers that became blocked (an ingredient they supply was unticked) drop out of the selection
  const chosenSuppliers = supplierItems.filter(s => !s.blocked && supplierIds.has(s.id)).map(s => s.id)

  const archive = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clients/${client.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientIds: [...ingredientIds], supplierIds: chosenSuppliers }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not archive client'))
    },
    onSuccess: () => {
      // Projects, formulations, ingredients and suppliers can all change, so refresh everything
      queryClient.invalidateQueries()
      toast.success(`${client.name} archived`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message, { duration: 8000 }),
  })

  const projectCount = plan?.projects.length ?? 0
  return (
    <DialogFrame
      title={`Archive ${client.name}`}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={() => archive.mutate()} disabled={!plan || archive.isPending}
          data-tip="Archives the client and everything listed above. Nothing is deleted, and you can unarchive it later."
          className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50">
          {archive.isPending ? 'Archiving…' : 'Archive client'}
        </button>
      </>}
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">Working out what goes with it…</p>
      ) : isError || !plan ? (
        <p className="text-sm text-red-500">Could not load this client’s projects.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {projectCount === 0
              ? 'This client has no projects. '
              : `This also archives its ${plural(projectCount, 'project')} and ${plural(plan.formulationCount, 'formulation')}. `}
            Archived items are hidden from lists and pickers but nothing is deleted. When you unarchive the client
            you choose which of them to bring back.
          </p>
          <Checklist
            title="Also archive ingredients"
            description="Ingredients this client’s formulations use. Ones also used for other clients or projects stay in the library."
            items={plan.ingredients.map(i => ({ id: i.id, label: i.name, blocked: ingredientBlock(i) }))}
            selected={ingredientIds}
            onChange={setIngredientIds}
          />
          <Checklist
            title="Also archive suppliers"
            description="Suppliers of those ingredients. A supplier can only be archived when every ingredient it supplies is archived too."
            items={supplierItems}
            selected={new Set(chosenSuppliers)}
            onChange={setSupplierIds}
          />
          {plan.ingredients.length === 0 && projectCount > 0 && (
            <p className="text-xs text-gray-400">None of this client’s formulations use ingredients that could be archived with it.</p>
          )}
        </>
      )}
    </DialogFrame>
  )
}

/** Unarchive a client and pick which of its archived projects, formulations, ingredients and suppliers come back. */
export function UnarchiveClientDialog({ client, onClose }: { client: { id: string; name: string }; onClose: () => void }) {
  const queryClient = useQueryClient()
  // null until the plan loads, then defaults to everything archived along with the client
  const [pick, setPick] = useState<Record<'projects' | 'formulations' | 'ingredients' | 'suppliers', Set<string>> | null>(null)

  const { data: plan, isLoading, isError } = useQuery<ClientRestorePlan>({
    queryKey: ['client-restore-plan', client.id],
    queryFn: async () => {
      const r = await fetch(`/api/clients/${client.id}/unarchive`)
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not load'))
      return r.json()
    },
    staleTime: 0,
  })

  const sel = pick ?? (plan ? {
    projects: new Set(plan.projects.filter(p => p.withClient).map(p => p.id)),
    formulations: new Set(plan.formulations.map(f => f.familyId)),
    ingredients: new Set(plan.ingredients.map(i => i.id)),
    suppliers: new Set(plan.suppliers.map(s => s.id)),
  } : null)
  const setPart = (k: keyof NonNullable<typeof sel>) => (next: Set<string>) => setPick({ ...sel!, [k]: next })

  const restore = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clients/${client.id}/unarchive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: [...sel!.projects],
          familyIds: [...sel!.formulations],
          ingredientIds: [...sel!.ingredients],
          supplierIds: [...sel!.suppliers],
        }),
      })
      if (!r.ok) throw new Error(await readErrorMessage(r, 'Could not unarchive client'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(`${client.name} unarchived`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const nothingArchived = plan && plan.projects.length + plan.formulations.length + plan.ingredients.length + plan.suppliers.length === 0
  return (
    <DialogFrame
      title={`Unarchive ${client.name}`}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={() => restore.mutate()} disabled={!sel || restore.isPending}
          data-tip="Brings the client back, with the items ticked above. Anything left unticked stays archived and can be restored on its own later."
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          {restore.isPending ? 'Unarchiving…' : 'Unarchive client'}
        </button>
      </>}
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isError || !plan || !sel ? (
        <p className="text-sm text-red-500">Could not load what was archived.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {nothingArchived
              ? 'Nothing else is archived with this client. Unarchiving puts it back in your client list and the project dropdown.'
              : 'Choose what to bring back with the client. Anything you leave unticked stays archived, and you can restore it on its own later.'}
          </p>
          <Checklist
            title="Projects"
            description="Restored projects become active again."
            items={plan.projects.map(p => ({ id: p.id, label: p.name, detail: p.withClient ? undefined : 'Archived before the client was' }))}
            selected={sel.projects}
            onChange={setPart('projects')}
          />
          <Checklist
            title="Formulations"
            description="Every version of a restored formulation comes back."
            items={plan.formulations.map(f => ({ id: f.familyId, label: f.name, detail: f.projectName }))}
            selected={sel.formulations}
            onChange={setPart('formulations')}
          />
          <Checklist
            title="Ingredients"
            description="Back in the ingredient library and pickers."
            items={plan.ingredients.map(i => ({ id: i.id, label: i.name }))}
            selected={sel.ingredients}
            onChange={setPart('ingredients')}
          />
          <Checklist
            title="Suppliers"
            description="Back in the supplier list."
            items={plan.suppliers.map(s => ({ id: s.id, label: s.name }))}
            selected={sel.suppliers}
            onChange={setPart('suppliers')}
          />
        </>
      )}
    </DialogFrame>
  )
}
