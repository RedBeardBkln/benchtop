'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Check, CopyPlus, FlaskConical, Loader2, Undo2, X } from 'lucide-react'
import type { ProposalView, SaveAs } from '@/lib/sous-chef-proposals'
import { useSousChef } from './sous-chef-session'

// A formulation change Sous Chef proposed, shown in the chat with exactly what would change.
// Nothing is saved until the person chooses to save it, as a new iteration or over the iteration
// itself; a change saved over the iteration can be reverted from here.

const fmtG = (n: number | null) => (n == null ? '–' : `${Number(n.toFixed(4))} g`)
const fmtPct = (n: number | null) => (n == null ? '' : `${Number(n.toFixed(2))}%`)

type Action = SaveAs | 'decline' | 'revert'
type Answer = { proposal?: ProposalView | null; error?: string; code?: string | null }

export function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const qc = useQueryClient()
  const { page, updateProposal, hasUnsaved, followLink } = useSousChef()
  const [busy, setBusy] = useState<Action | null>(null)
  const p = proposal.preview
  const v = `v${p.version}`
  const resultHref = proposal.resultFormulationId ? `/formulations/${proposal.resultFormulationId}` : null
  const onThisPage = page?.formulation?.id === proposal.formulationId

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch(`/api/sous-chef/proposals/${proposal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { ok: r.ok, data: await r.json().catch(() => ({})) as Answer }
  }

  // The formulation on screen is out of date after a save over it or a revert; reload (the chat comes back)
  const refreshScreen = (message: string) => {
    qc.invalidateQueries({ queryKey: ['formulation'] })
    if (onThisPage) {
      toast.success(message)
      window.location.reload()
      return true
    }
    return false
  }

  async function act(action: Action) {
    if (action !== 'decline' && onThisPage && hasUnsaved()) {
      toast.warning('This formulation has unsaved changes', {
        description: action === 'new_iteration'
          ? 'The new iteration is copied from the saved formulation. Save or undo your changes first.'
          : 'Save or undo them first, so they don’t overwrite this change or get overwritten by it.',
      })
      return
    }
    if (action === 'revert' && !window.confirm(`Put ${v} back the way it was before this change?`)) return
    setBusy(action)
    try {
      let { ok, data } = action === 'decline'
        ? await post({ decision: 'decline' })
        : action === 'revert'
          ? await post({ decision: 'revert' })
          : await post({ decision: 'approve', saveAs: action })
      // Edited after the change was saved: reverting would undo those edits too, so ask first
      if (action === 'revert' && !ok && data.code === 'edited_since') {
        if (!window.confirm(`${data.error}\n\nRevert anyway?`)) return
        ;({ ok, data } = await post({ decision: 'revert', force: true }))
      }
      if (data.proposal) updateProposal(data.proposal)
      if (!ok) {
        toast.error(data.error ?? 'Could not save your decision')
        return
      }
      const done = data.proposal!
      if (action === 'decline') return
      if (action === 'revert') {
        if (!refreshScreen(`${v} reverted`)) toast.success(`${v} is back as it was before the change`)
        return
      }
      if (action === 'this_iteration') {
        if (!refreshScreen('Change saved')) {
          toast.success(`Change saved over ${v}`, { action: { label: 'Open', onClick: () => { window.location.href = `/formulations/${done.resultFormulationId}` } } })
        }
        return
      }
      qc.invalidateQueries({ queryKey: ['formulation'] })
      toast.success(`New iteration v${done.resultVersion} saved`, {
        action: { label: 'Open', onClick: () => { window.location.href = `/formulations/${done.resultFormulationId}` } },
      })
    } catch {
      toast.error('Could not save your decision. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  // Sous Chef's suggestion is the main button; the other way to save sits beside it
  const suggested: SaveAs = p.newIteration || !proposal.canSaveOver ? 'new_iteration' : 'this_iteration'
  type SaveButton = { action: SaveAs; label: string; icon: React.ReactNode }
  const saveButtons: SaveButton[] = [
    { action: 'new_iteration', label: 'Save as new iteration', icon: <CopyPlus size={13} /> } as SaveButton,
    ...(proposal.canSaveOver ? [{ action: 'this_iteration', label: `Save over ${v}`, icon: <Check size={13} /> } as SaveButton] : []),
  ].sort((a, b) => (a.action === suggested ? -1 : b.action === suggested ? 1 : 0))

  const status = proposal.status === 'applied'
    ? {
        text: p.newIteration ? `Saved as new iteration v${proposal.resultVersion ?? ''}` : `Saved over ${v}`,
        cls: 'bg-green-50 text-green-800 border-green-200',
      }
    : proposal.status === 'reverted'
      ? { text: `Saved over ${v}, then reverted: ${v} is back as it was`, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
      : proposal.status === 'declined'
        ? { text: 'Declined', cls: 'bg-gray-50 text-gray-600 border-gray-200' }
        : { text: 'Out of date: the formulation changed after this was proposed', cls: 'bg-amber-50 text-amber-900 border-amber-200' }

  return (
    <div className="rounded-lg border border-blue-200 bg-white text-sm overflow-hidden">
      <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <FlaskConical size={15} className="mt-0.5 shrink-0 text-blue-700" />
        <div className="min-w-0">
          <p className="font-medium text-blue-900">Change to {p.formulationName} {v}</p>
          <p className="text-xs text-blue-900/80">{p.summary}</p>
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-3">
        {p.lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="font-medium py-1 pr-2">Ingredient</th>
                  <th className="font-medium py-1 px-2 text-right">Now</th>
                  <th className="font-medium py-1 pl-2 text-right">After</th>
                </tr>
              </thead>
              <tbody>
                {p.lines.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1 pr-2">
                      <span className={l.change === 'removed' ? 'line-through text-gray-400' : 'text-gray-800'}>{l.ingredient}</span>
                      {l.change !== 'changed' && <span className={`ml-1.5 text-[10px] uppercase tracking-wide ${l.change === 'added' ? 'text-green-700' : 'text-red-600'}`}>{l.change}</span>}
                    </td>
                    <td className="py-1 px-2 text-right text-gray-500 whitespace-nowrap">{fmtG(l.fromG)} <span className="text-gray-400">{fmtPct(l.fromPct)}</span></td>
                    <td className="py-1 pl-2 text-right text-gray-900 font-medium whitespace-nowrap">{fmtG(l.toG)} <span className="text-gray-500 font-normal">{fmtPct(l.toPct)}</span></td>
                  </tr>
                ))}
                {p.totals.fromG !== p.totals.toG && (
                  <tr className="border-t border-gray-200 text-gray-600">
                    <td className="py-1 pr-2">Batch total</td>
                    <td className="py-1 px-2 text-right whitespace-nowrap">{fmtG(p.totals.fromG)}</td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap font-medium">{fmtG(p.totals.toG)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-gray-400">Only the ingredients that change are listed.</p>
          </div>
        )}

        {p.steps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Process steps</p>
            <ul className="space-y-1.5">
              {p.steps.map((s, i) => (
                <li key={i} className="text-xs">
                  <span className={`mr-1.5 text-[10px] uppercase tracking-wide ${s.change === 'added' ? 'text-green-700' : s.change === 'removed' ? 'text-red-600' : 'text-blue-700'}`}>{s.change}</span>
                  {s.change === 'removed' ? (
                    <span className="line-through text-gray-400">Step {s.from!.no}: {s.from!.text}</span>
                  ) : s.change === 'added' ? (
                    <span className="text-gray-800">Step {s.to!.no}: {s.to!.text}</span>
                  ) : (
                    <span className="text-gray-800">
                      Step {s.from!.no}{s.to!.no !== s.from!.no && ` (becomes ${s.to!.no})`}: {s.to!.text}
                      {s.to!.text !== s.from!.text && <span className="block text-gray-400 line-through">{s.from!.text}</span>}
                    </span>
                  )}
                  {s.notes.length > 0 && <span className="block text-gray-500 pl-4">{s.notes.join(' · ')}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {p.details.length > 0 && (
          <ul className="space-y-0.5 text-xs">
            {p.details.map((d, i) => (
              <li key={i} className="text-gray-700">
                <span className="text-gray-500">{d.label}:</span> {d.from ?? '–'} → <span className="font-medium">{d.to ?? '–'}</span>
              </li>
            ))}
          </ul>
        )}

        {p.iterationNote && <p className="text-xs text-gray-600"><span className="text-gray-500">Iteration note:</span> {p.iterationNote}</p>}

        {p.warnings.length > 0 && (
          <ul className="space-y-1">
            {p.warnings.map((w, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-amber-800">
                <AlertTriangle size={13} className="shrink-0 mt-px" /> {w}
              </li>
            ))}
          </ul>
        )}

        {proposal.status === 'pending' ? (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              {saveButtons.map((b, i) => (
                <button
                  key={b.action} type="button" onClick={() => act(b.action)} disabled={!!busy}
                  data-tip={b.action === 'new_iteration'
                    ? `Copies ${v} as the next version with this change; ${v} stays as it is`
                    : `Changes ${v} itself; you can revert it afterwards`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50 ${
                    i === 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-blue-300 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {busy === b.action ? <Loader2 size={13} className="animate-spin" /> : b.icon} {b.label}
                </button>
              ))}
              <button
                type="button" onClick={() => act('decline')} disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === 'decline' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Decline
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              {proposal.canSaveOver
                ? `Sous Chef suggests ${suggested === 'new_iteration' ? 'a new iteration' : `saving over ${v}`}. Nothing is saved until you choose.`
                : `${v} is locked, so this can only be saved as a new iteration. Nothing is saved until you choose.`}
            </p>
          </div>
        ) : (
          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 rounded border text-xs ${status.cls}`}>
            <span>{status.text}</span>
            {proposal.status === 'applied' && resultHref && (
              <a href={resultHref} onClick={e => followLink(e, resultHref)} className="font-medium underline">
                Open {p.newIteration && proposal.resultVersion ? `v${proposal.resultVersion}` : v}
              </a>
            )}
            {proposal.canRevert && (
              <button
                type="button" onClick={() => act('revert')} disabled={!!busy}
                data-tip={`Puts ${v} back exactly as it was before this change`}
                className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Revert
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
