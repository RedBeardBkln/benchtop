import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'
import { requirePage } from '@/lib/auth/context'
import { needsLegalAcceptance, PRIVACY_EFFECTIVE_DATE, PRIVACY_VERSION, TERMS_EFFECTIVE_DATE, TERMS_VERSION } from '@/lib/legal'
import { AcceptTermsForm } from '@/components/legal/accept-terms-form'

// Every user lands here until they have accepted the current Terms and Privacy Policy
// (requirePage redirects here; APIs answer 403 terms_required).
export default async function AcceptTermsPage() {
  const ctx = await requirePage({ allowUnentitled: true, allowWithoutTerms: true })
  if (!needsLegalAcceptance(ctx.profile)) redirect('/projects')

  const firstTime = !ctx.profile?.termsVersion && !ctx.profile?.privacyVersion

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-4">
        <Logo variant="wordmark" height={13} className="text-ink-700" />
        <h1 className="text-2xl font-semibold text-gray-900">
          {firstTime ? 'Before you continue' : 'We have updated our Terms and Privacy Policy'}
        </h1>
        <p className="text-sm text-gray-600">
          Please read and accept the Terms of Service (effective {TERMS_EFFECTIVE_DATE}) and the Privacy Policy
          (effective {PRIVACY_EFFECTIVE_DATE}) to keep using Benchtop.
        </p>
        <div className="rounded-md bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
          <strong>The bottom line:</strong> We will never sell your data or your clients&apos; data, and we will not share it with anyone unless
          required or mandated by law.
        </div>
        <AcceptTermsForm termsVersion={TERMS_VERSION} privacyVersion={PRIVACY_VERSION} />
      </div>
    </div>
  )
}
