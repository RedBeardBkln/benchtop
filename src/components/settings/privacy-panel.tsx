'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readErrorMessage } from '@/lib/utils'
import { btnDanger, btnSecondary, Card, Field, inputCls, Notice } from './ui'

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
      <Card title="Your data" description="Download everything stored in your account as a JSON file: projects, formulations, ingredients and inventory, suppliers, equipment and your profile.">
        {isOwner ? (
          <a href="/api/account/export" download className={btnSecondary}>
            <Download size={14} className="mr-2" />
            Download my data
          </a>
        ) : (
          <p className="text-sm text-gray-500">Only the account owner can export the account data.</p>
        )}
      </Card>

      <Card
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
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </form>
        )}
      </Card>
    </>
  )
}
