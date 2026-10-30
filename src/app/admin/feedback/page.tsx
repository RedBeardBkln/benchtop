import { AppShell } from '@/components/app-shell'
import { FeedbackAdmin } from '@/components/admin/feedback-admin'
import { requirePage } from '@/lib/auth/context'

// Platform admins only; everyone else gets a 404.
export default async function AdminFeedbackPage() {
  const ctx = await requirePage({ allowUnentitled: true, platformAdmin: true })

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <div className="px-4 py-5 sm:px-8 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Feedback</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bug reports and feature requests sent from the link at the foot of every page.
          </p>
        </div>
        <FeedbackAdmin />
      </div>
    </AppShell>
  )
}
