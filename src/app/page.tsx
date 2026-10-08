import { redirect } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'

export default async function HomePage() {
  // Unauthenticated -> /login, no account -> /no-account, unentitled -> billing page
  await requirePage()
  redirect('/projects')
}
