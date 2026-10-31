import { notFound } from 'next/navigation'
import { InvoicingConnectionPanel } from '@/components/settings/invoicing-connection-panel'
import { requirePage } from '@/lib/auth/context'
import { canUseInvoicingConnection } from '@/lib/invoicing-connection'

export default async function InvoicingConnectionSettingsPage() {
  const ctx = await requirePage({ allowUnentitled: true })
  if (!canUseInvoicingConnection(ctx.user.email)) notFound()
  return <InvoicingConnectionPanel />
}
