import { ProfileForm } from '@/components/settings/profile-form'
import { requirePage } from '@/lib/auth/context'

export default async function ProfileSettingsPage() {
  const ctx = await requirePage({ allowUnentitled: true })
  return (
    <ProfileForm
      email={ctx.user.email ?? ''}
      initial={{
        fullName: ctx.profile?.fullName ?? '',
        company: ctx.profile?.company ?? '',
        jobTitle: ctx.profile?.jobTitle ?? '',
        phone: ctx.profile?.phone ?? '',
        timezone: ctx.profile?.timezone ?? '',
      }}
    />
  )
}
