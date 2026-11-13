'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, FileJson } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readErrorMessage } from '@/lib/utils'
import { btnDanger, btnPrimary, btnSecondary, Card, Field, inputCls, Notice } from './ui'
import { ExportDataDialog } from './export-data-dialog'

export function PrivacyPanel({
  email,
  isOwner,
  isProtected,
}: {
  email: string
  isOwner: boolean
  isProtected: boolean
}) {
  const router = useRouter()
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!window.confirm('This permanently deletes your account and all of its data. This cannot be undone. Continue?')) return
    setDeleting(true)
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmEmail }),
    })
    if (!res.ok) {
      setDeleting(false)
      return toast.error(await readErrorMessage(res, 'Could not delete the account'))
    }
    await createClient().auth.signOut().catch(() => undefined)
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <Card tour="settings-privacy-export" title="Your data" description="Download everything stored in your account as one zip file: projects and clients, formulations and their nutrition, Nutrition Facts panels, suppliers and ingredients with their documents, time, the team and Sous Chef, as Excel, Word, PDF or image files. A JSON copy for importing into other software is also available.">
        {isOwner ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setExportOpen(true)} className={btnPrimary}
              data-tip="Choose Excel, Word, PDF or images for each part, then download everything as one zip file">
              <Download size={14} className="mr-2" />
              Download my data
            </button>
            <a href="/api/account/export" download className={btnSecondary}
              data-tip="Downloads everything in this account as one JSON file, for importing into other software">
              <FileJson size={14} className="mr-2" />
              Download as JSON
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Only the account owner can export the account data.</p>
        )}
      </Card>
      {exportOpen && <ExportDataDialog onClose={() => setExportOpen(false)} />}

      <Card
        tour="settings-privacy-delete"
        tone="danger"
        title="Delete account"
        description="Permanently deletes your account, all of its data and your login, and cancels your subscription. This cannot be undone."
      >
        {!isOwner ? (
          <p className="text-sm text-gray-500">Only the account owner can delete the account.</p>
        ) : isProtected ? (
          <Notice tone="info">This is an internal account and cannot be deleted from the app.</Notice>
        ) : (
          <form onSubmit={deleteAccount} className="space-y-3 max-w-lg">
            <Field label={`Type your email (${email}) to confirm`} htmlFor="confirmEmail">
              <input id="confirmEmail" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} className={inputCls} autoComplete="off" />
            </Field>
            <button
              type="submit"
              className={btnDanger}
              disabled={deleting || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
              data-tip={confirmEmail.trim().toLowerCase() !== email.toLowerCase()
                ? 'Type your email exactly as shown to enable this.'
                : 'Asks once more, then permanently deletes the account, its data and your login, and cancels the subscription.'}
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </form>
        )}
      </Card>
    </>
  )
}
