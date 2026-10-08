import { redirect } from 'next/navigation'
import { getContext } from '@/lib/auth/context'
import { SignOutButton } from '@/components/settings/sign-out-button'

// Landing page for a signed-in user who has no account (e.g. they signed up without an invitation,
// or their account was removed). They get no data and no way in other than an invitation.
export default async function NoAccountPage() {
  const result = await getContext()
  if (!result.ok && result.reason === 'unauthenticated') redirect('/login')
  // Users who do have an account have no business here
  if (result.ok || result.reason === 'not_entitled') redirect('/projects')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">No account found</h1>
        <p className="text-sm text-gray-600">
          You are signed in, but this login is not linked to a Benchtop account. Access is by invitation only. If you
          were invited, open the invitation link you were sent. Otherwise, please contact the person who manages
          Benchtop access.
        </p>
        <SignOutButton />
      </div>
    </div>
  )
}
