import Link from 'next/link'
import { InviteForm } from '@/components/invite/invite-form'
import { INVITE_FAILURE_MESSAGES } from '@/lib/invitations'
import { lookupInvite } from '@/lib/invitations-server'

// Public page. The token is validated server-side; the form re-validates on submit.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await lookupInvite(token)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Join Benchtop</h1>
          <p className="text-sm text-gray-500 mt-1">You have been invited to create an account.</p>
        </div>

        {result.ok ? (
          <InviteForm token={token} email={result.invite.email} />
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
