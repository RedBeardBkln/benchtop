import { describe, expect, it } from 'vitest'
import { checkArchiveSelection, ingredientBlock, supplierBlock, type ClientArchivePlan } from './client-archive-plan'

const plan: ClientArchivePlan = {
  projects: [{ id: 'p1', name: 'Bar', status: 'active' }],
  formulationCount: 2,
  ingredients: [
    { id: 'oats', name: 'Oats', otherFormulations: 0 },
    { id: 'honey', name: 'Honey', otherFormulations: 0 },
    { id: 'salt', name: 'Salt', otherFormulations: 3 },
  ],
  suppliers: [
    { id: 'mill', name: 'Mill Co', clientIngredientIds: ['oats'], otherIngredients: 0 },
    { id: 'farm', name: 'Farm Co', clientIngredientIds: ['oats', 'honey'], otherIngredients: 0 },
    { id: 'big', name: 'Big Co', clientIngredientIds: ['honey'], otherIngredients: 2 },
    { id: 'sea', name: 'Sea Co', clientIngredientIds: ['salt'], otherIngredients: 0 },
  ],
}

describe('ingredientBlock', () => {
  it('allows ingredients only this client uses', () => {
    expect(ingredientBlock(plan.ingredients[0])).toBeNull()
  })
  it('blocks ingredients used elsewhere', () => {
    expect(ingredientBlock(plan.ingredients[2])).toMatch(/3 formulations/)
  })
})

describe('supplierBlock', () => {
  it('needs every client ingredient it supplies to be archived', () => {
    const [mill, farm] = plan.suppliers
    expect(supplierBlock(mill, plan.ingredients, new Set(['oats']))).toBeNull()
    expect(supplierBlock(farm, plan.ingredients, new Set(['oats']))).toMatch(/Honey/)
    expect(supplierBlock(farm, plan.ingredients, new Set(['oats', 'honey']))).toBeNull()
  })
  it('blocks suppliers with other ingredients', () => {
    expect(supplierBlock(plan.suppliers[2], plan.ingredients, new Set(['honey']))).toMatch(/2 other ingredients/)
  })
})

describe('checkArchiveSelection', () => {
  it('accepts a valid selection', () => {
    expect(checkArchiveSelection(plan, ['oats', 'honey'], ['mill', 'farm'])).toBeNull()
    expect(checkArchiveSelection(plan, [], [])).toBeNull()
  })
  it('rejects ingredients used elsewhere and unknown ids', () => {
    expect(checkArchiveSelection(plan, ['salt'], [])).toMatch(/Salt/)
    expect(checkArchiveSelection(plan, ['nope'], [])).toMatch(/isn’t used/)
  })
  it('rejects a supplier whose ingredient stays', () => {
    expect(checkArchiveSelection(plan, ['oats'], ['farm'])).toMatch(/Farm Co/)
    expect(checkArchiveSelection(plan, ['salt'], ['sea'])).toMatch(/Salt/)
  })
})
