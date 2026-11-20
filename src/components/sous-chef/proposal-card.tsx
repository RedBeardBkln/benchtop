'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Check, FlaskConical, Loader2, X } from 'lucide-react'
import type { ProposalView } from '@/lib/sous-chef-proposals'
import { useSousChef } from './sous-chef-session'

// A formulation change Sous Chef proposed, shown in the chat with exactly what would change.
// Nothing is saved until the person clicks Approve.

const fmtG = (n: number | null) => (n == null ? '–' : `${Number(n.toFixed(4))} g`)
const fmtPct = (n: number | null) => (n == null ? '' : `${Number(n.toFixed(2))}%`)

const STATUS = {
  applied: { text: 'Approved and saved', cls: 'bg-green-50 text-green-800 border-green-200' },
  declined: { text: 'Declined', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  stale: { text: 'Out of date: the formulation changed after this was proposed', cls: 'bg-amber-50 text-amber-900 border-amber-200' },
} as const

export function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const qc = useQueryClient()
  const { page, updateProposal, hasUnsaved, followLink } = useSousChef()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const p = proposal.preview
  const resultHref = proposal.resultFormulationId ? `/formulations/${proposal.resultFormulationId}` : null
  const onThisPage = page?.formulation?.id === proposal.formulationId

  async function decide(decision: 'approve' | 'decline') {
    if (decision === 'approve' && onThisPage && hasUnsaved()) {
      toast.warning('This formulation has unsaved changes', {
        description: p.newIteration
          ? 'The new iteration is copied from the saved formulation. Save or undo your changes first.'
          : 'Save or undo them first, so Sous Chef’s change doesn’t overwrite them or get overwritten.',
      })
      return
    }
    setBusy(decision)
    try {
      const r = await fetch(`/api/sous-chef/proposals/${proposal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await r.json().catch(() => ({})) as { proposal?: ProposalView | null; error?: string }
      if (data.proposal) updateProposal(data.proposal)
      if (!r.ok) {
        toast.error(data.error ?? 'Could not save your decision')
        return
      }
      if (decision === 'decline') return
      const done = data.proposal!
      qc.invalidateQueries({ queryKey: ['formulation'] })
      const href = `/formulations/${done.resultFormulationId}`
      if (onThisPage && !p.newIteration) {
        // The formulation on screen is now out of date; reload it (the chat comes back with it)
        toast.success('Change saved')
        window.location.reload()
      } else {
        toast.success(p.newIteration ? `New iteration v${done.resultVersion} saved` : 'Change saved', {
          action: { label: 'Open', onClick: () => { window.location.href = href } },
        })
      }
    } catch {
      toast.error('Could not save your decision. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-white text-sm overflow-hidden">
      <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <FlaskConical size={15} className="mt-0.5 shrink-0 text-blue-700" />
        <div className="min-w-0">
          <p className="font-medium text-blue-900">
            {p.newIteration ? `New iteration of ${p.formulationName}, from v${p.version}` : `Change to ${p.formulationName} v${p.version}`}
          </p>
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
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button" onClick={() => decide('approve')} disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {p.newIteration ? 'Approve and create the iteration' : 'Approve and save'}
            </button>
            <button
              type="button" onClick={() => decide('decline')} disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'decline' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Decline
            </button>
            <span className="text-[11px] text-gray-400">Nothing is saved until you approve.</span>
          </div>
        ) : (
          <p className={`px-2 py-1 rounded border text-xs ${STATUS[proposal.status].cls}`}>
            {STATUS[proposal.status].text}
            {proposal.status === 'applied' && resultHref && (
              <> · <a href={resultHref} onClick={e => followLink(e, resultHref)} className="font-medium underline">
                Open {p.newIteration && proposal.resultVersion ? `v${proposal.resultVersion}` : 'it'}
              </a></>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
