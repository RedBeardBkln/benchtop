import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'
import { getContext } from '@/lib/auth/context'
import { SignOutButton } from '@/components/settings/sign-out-button'

// Landing page for someone whose account, or whose own login, a platform admin has suspended
export default async function SuspendedPage() {
  const result = await getContext()
  if (!result.ok && result.reason === 'unauthenticated') redirect('/login')
  if (!result.ok && result.reason === 'no_account') redirect('/no-account')
  if (result.ok || result.reason !== 'suspended') redirect('/projects')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-4">
        <Logo variant="wordmark" height={13} className="text-gray-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Access suspended</h1>
        <p className="text-sm text-gray-600">
          Access to Benchtop has been suspended for this login. Your data hasn&apos;t been deleted. Please contact
          Benchtop support if you think this is a mistake.
        </p>
        <SignOutButton />
      </div>
    </div>
  )
}
