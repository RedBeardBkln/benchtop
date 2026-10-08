import Link from 'next/link'
import { PrivacyPanel } from '@/components/settings/privacy-panel'
import { Card, formatDate } from '@/components/settings/ui'
import { requirePage } from '@/lib/auth/context'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal'

export default async function PrivacySettingsPage() {
  const ctx = await requirePage({ allowUnentitled: true })
  const p = ctx.profile

  return (
    <>
      <Card title="Terms and Privacy Policy" description="The documents that govern your use of Benchtop.">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
          <div>
            <dt className="text-gray-500">Terms of Service</dt>
            <dd className="text-gray-900">
              {p?.termsVersion ? `Accepted version ${p.termsVersion} on ${formatDate(p.termsAcceptedAt)}` : 'No acceptance recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Privacy Policy</dt>
            <dd className="text-gray-900">
              {p?.privacyVersion ? `Accepted version ${p.privacyVersion} on ${formatDate(p.privacyAcceptedAt)}` : 'No acceptance recorded'}
            </dd>
          </div>
        </dl>
        <div className="flex gap-4 text-sm">
          <Link href="/legal/terms" className="text-blue-600 hover:underline">Read the Terms (v{TERMS_VERSION})</Link>
          <Link href="/legal/privacy" className="text-blue-600 hover:underline">Read the Privacy Policy (v{PRIVACY_VERSION})</Link>
        </div>
      </Card>

      <PrivacyPanel
        email={ctx.user.email ?? ''}
        isOwner={ctx.role === 'owner'}
        isProtected={ctx.account.billingExempt}
      />
    </>
  )
}
