'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PASSWORD_MIN_LENGTH } from '@/lib/account-schemas'
import { readErrorMessage } from '@/lib/utils'
import { btnPrimary, btnSecondary, Card, Field, formatDate, inputCls, Notice } from './ui'

export function AccountSettings({
  email,
  accountId,
  accountName,
  createdAt,
  role,
  isOwner,
}: {
  email: string
  accountId: string
  accountName: string
  createdAt: string
  role: string
  isOwner: boolean
}) {
  const router = useRouter()

  // ---- account name
  const [name, setName] = useState(accountName)
  const [savingName, setSavingName] = useState(false)

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSavingName(false)
    if (!res.ok) return toast.error(await readErrorMessage(res, 'Could not rename the account'))
    toast.success('Account name saved')
    router.refresh()
  }

  // ---- email
  const [newEmail, setNewEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailNotice, setEmailNotice] = useState('')

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailSending(true)
    setEmailNotice('')
    const { error } = await createClient().auth.updateUser({ email: newEmail.trim() })
    setEmailSending(false)
    if (error) return toast.error(error.message)
    setEmailNotice(`We sent a confirmation link to ${newEmail.trim()}. Your sign-in email changes once you confirm it.`)
    setNewEmail('')
  }

  // ---- password
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < PASSWORD_MIN_LENGTH) return toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    if (password !== confirm) return toast.error('Passwords do not match')
    setSavingPw(true)
    const { error } = await createClient().auth.updateUser({ password })
    setSavingPw(false)
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    setPassword('')
    setConfirm('')
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <Card title="Account" description="The workspace your projects, ingredients and inventory live in. Nothing in it is visible to other accounts.">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
          <div><dt className="text-gray-500">Your role</dt><dd className="text-gray-900 capitalize">{role}</dd></div>
          <div><dt className="text-gray-500">Created</dt><dd className="text-gray-900">{formatDate(createdAt)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Account ID</dt><dd className="text-gray-900 font-mono text-xs break-all">{accountId}</dd></div>
        </dl>
        <form onSubmit={saveName} className="space-y-3 max-w-lg">
          <Field label="Account name" htmlFor="accountName" hint={isOwner ? undefined : 'Only the account owner can rename the account.'}>
            <input id="accountName" required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={!isOwner} className={inputCls} />
          </Field>
          {isOwner && (
            <button type="submit" disabled={savingName || name.trim() === accountName} className={btnPrimary}>
              {savingName ? 'Saving…' : 'Save name'}
            </button>
          )}
        </form>
      </Card>

      <Card title="Sign-in email" description={`Currently ${email}`}>
        <form onSubmit={changeEmail} className="space-y-3 max-w-lg">
          <Field label="New email" htmlFor="newEmail">
            <input id="newEmail" type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} className={inputCls} autoComplete="email" />
          </Field>
          <button type="submit" disabled={emailSending || !newEmail} className={btnPrimary}>
            {emailSending ? 'Sending…' : 'Change email'}
          </button>
          {emailNotice && <Notice tone="info">{emailNotice}</Notice>}
        </form>
      </Card>

      <Card title="Password">
        <form onSubmit={changePassword} className="space-y-3 max-w-lg">
          <Field label="New password" htmlFor="newPassword" hint={`At least ${PASSWORD_MIN_LENGTH} characters`}>
            <input id="newPassword" type="password" required minLength={PASSWORD_MIN_LENGTH} value={password} onChange={e => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword">
            <input id="confirmPassword" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
          </Field>
          <button type="submit" disabled={savingPw} className={btnPrimary}>
            {savingPw ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </Card>

      <Card title="Session">
        <button onClick={signOut} className={btnSecondary}>
          <LogOut size={14} className="mr-2" />
          Sign out
        </button>
      </Card>
    </>
  )
}
