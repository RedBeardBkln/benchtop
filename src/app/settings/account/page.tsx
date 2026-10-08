import { AccountSettings } from '@/components/settings/account-settings'
import { requirePage } from '@/lib/auth/context'

export default async function AccountSettingsPage() {
  const ctx = await requirePage({ allowUnentitled: true })
  return (
    <AccountSettings
      email={ctx.user.email ?? ''}
      accountId={ctx.account.id}
      accountName={ctx.account.name}
      createdAt={ctx.account.createdAt.toISOString()}
      role={ctx.role}
      isOwner={ctx.role === 'owner'}
    />
  )
}
