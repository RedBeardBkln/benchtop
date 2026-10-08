import { requirePage } from '@/lib/auth/context'
import { AppShell } from '@/components/app-shell'
import { IngredientTable } from '@/components/ingredients/ingredient-table'

export default async function IngredientsPage() {
  const ctx = await requirePage()

  return (
    <AppShell userEmail={ctx.user.email} isPlatformAdmin={ctx.isPlatformAdmin}>
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
