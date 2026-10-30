import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { canEditLibrary } from '@/lib/team-access'
import { AppShell } from '@/components/app-shell'
import { LabIntake } from '@/components/ingredients/lab-intake'

export default async function LabIntakePage() {
  const ctx = await requirePage()
  // Intake only adds to the library, so it's of no use with view-only access
  if (!canEditLibrary(ctx.access)) redirect('/ingredients')

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
      <div className="px-4 py-5 sm:px-8 sm:py-8">
        <Link href="/ingredients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3">
          <ArrowLeft size={14} /> Ingredient Directory
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Lab Intake</h1>
          <p className="text-sm text-gray-500 mt-1">
            Type each label or snap a photo of it. When the list is done, Claude identifies and categorizes
            every item, you review it, and then it goes into the ingredient library marked as on hand.
          </p>
        </div>
        <LabIntake />
      </div>
    </AppShell>
  )
}
