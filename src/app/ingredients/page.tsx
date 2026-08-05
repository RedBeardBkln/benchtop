import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { IngredientTable } from '@/components/ingredients/ingredient-table'

export default async function IngredientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppShell userEmail={user.email}>
      <div className="px-4 py-5 sm:px-8 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Ingredient Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            All ingredients with verified nutrient data. Every value carries a source reference.
          </p>
        </div>
        <IngredientTable />
      </div>
    </AppShell>
  )
}
