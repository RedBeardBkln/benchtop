import Link from 'next/link'
import { Logo } from '@/components/logo'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { InviteForm } from '@/components/invite/invite-form'
import { INVITE_FAILURE_MESSAGES } from '@/lib/invitations'
import { lookupInvite } from '@/lib/invitations-server'
import { asAccountPlan, describePlan } from '@/lib/billing/plans'

// Public page. The token is validated server-side; the form re-validates on submit.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await lookupInvite(token)

  // Team invitations join an existing account
  let teamName: string | undefined
  if (result.ok && result.invite.accountId) {
    const [account] = await db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, result.invite.accountId))
      .limit(1)
    teamName = account?.name
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <Logo variant="wordmark" height={13} className="mb-5 text-ink-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Join Benchtop</h1>
          <p className="text-sm text-gray-500 mt-1">
            {teamName ? `You have been invited to join the ${teamName} team.` : 'You have been invited to create an account.'}
          </p>
          {result.ok && !result.invite.accountId && (
            <p className="mt-3 rounded-md bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-800">
              {describePlan(asAccountPlan(result.invite.plan), result.invite.freeDays)}, starting when you create your account.
            </p>
          )}
        </div>

        {result.ok ? (
          <InviteForm token={token} email={result.invite.email} teamName={teamName} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {INVITE_FAILURE_MESSAGES[result.reason]}
            </div>
            <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline">
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
