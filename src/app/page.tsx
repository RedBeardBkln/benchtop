import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requirePage } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { SiteHome } from '@/components/site/site-home'

export const metadata: Metadata = {
  title: 'Benchtop — Food formulation R&D, from bench to label',
  description:
    'Benchtop is a formulation workspace for food, beverage and supplement developers: recipes, live nutrition, Nutrition Facts panels, costing, an ingredient library and an AI lab-mate. Now in invitation-only beta.',
}

export default async function HomePage() {
  // Visitors get the public site. Signed in: no account -> /no-account, unentitled -> billing page.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <SiteHome />

  await requirePage()
  redirect('/projects')
}
