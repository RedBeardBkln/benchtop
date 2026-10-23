import { describe, expect, it } from 'vitest'
import { computeCogs, formatMoney, fromPerKg, pricePerKg, resolveIngredientCost, toPerKg } from './costing'

const link = (o: Partial<Parameters<typeof resolveIngredientCost>[1][number]>) => ({
  id: 'l1', supplierName: 'Acme', packUnit: 'kg', costPerUnit: '4', useForCost: false, ...o,
})

describe('unit conversion', () => {
  it('converts mass-unit prices to per kg', () => {
    expect(pricePerKg(2, 'kg')).toBe(2)
    expect(pricePerKg(1, 'lb')).toBeCloseTo(2.20462, 4)
    expect(pricePerKg(0.005, 'g')).toBeCloseTo(5)
    expect(pricePerKg(2000, 'mt')).toBeCloseTo(2)
  })
  it('refuses non-mass units', () => {
    expect(pricePerKg(80, 'bag')).toBeNull()
    expect(pricePerKg(10, 'L')).toBeNull()
    expect(pricePerKg(10, null)).toBeNull()
  })
  it('round-trips $/lb', () => {
    expect(fromPerKg(toPerKg(3.5, 'lb'), 'lb')).toBeCloseTo(3.5)
    expect(toPerKg(3.5, 'kg')).toBe(3.5)
  })
})

describe('resolveIngredientCost', () => {
  it('uses the manual cost when no supplier price is chosen', () => {
    expect(resolveIngredientCost('2.5', [link({})])).toEqual({ cost: { perKg: 2.5, source: 'manual' }, warning: null })
  })
  it('prefers the chosen supplier price', () => {
    const r = resolveIngredientCost('2.5', [link({}), link({ id: 'l2', supplierName: 'Beta', packUnit: 'lb', costPerUnit: '1', useForCost: true })])
    expect(r.cost).toMatchObject({ source: 'supplier', supplierName: 'Beta', linkId: 'l2' })
    expect(r.cost!.perKg).toBeCloseTo(2.20462, 4)
  })
  it('falls back to manual, with a warning, when the chosen price is not per mass', () => {
    expect(resolveIngredientCost(3, [link({ packUnit: 'drum', useForCost: true })]))
      .toEqual({ cost: { perKg: 3, source: 'manual' }, warning: 'supplier-unit-not-mass' })
    expect(resolveIngredientCost(null, [link({ costPerUnit: null, useForCost: true })]))
      .toEqual({ cost: null, warning: 'supplier-price-missing' })
  })
  it('treats zero or blank as no cost', () => {
    expect(resolveIngredientCost('0', []).cost).toBeNull()
    expect(resolveIngredientCost('', []).cost).toBeNull()
  })
})

describe('computeCogs', () => {
  const costs: Record<string, number> = { oats: 2, whey: 10 }
  const lines = [
    { key: 'a', ingredientId: 'oats', name: 'Oats', weightG: 600 },
    { key: 'b', ingredientId: 'whey', name: 'Whey', weightG: 300 },
    { key: 'c', ingredientId: 'salt', name: 'Salt', weightG: 100 },
  ]
  const cogs = computeCogs({
    lines, costPerKg: id => costs[id] ?? null, finishedWeightG: 800, servingSizeG: 40, unitSizeG: 400,
  })

  it('costs each line on its input weight', () => {
    expect(cogs.lines.map(l => l.cost)).toEqual([1.2, 3, null])
    expect(cogs.lines.map(l => l.pct)).toEqual([60, 30, 10])
    expect(cogs.batchCost).toBeCloseTo(4.2)
    expect(cogs.missingCount).toBe(1)
  })
  it('gives each costed line its share of the total', () => {
    expect(cogs.lines[0].sharePct).toBeCloseTo(28.571, 2)
    expect(cogs.lines[1].sharePct).toBeCloseTo(71.429, 2)
    expect(cogs.lines[2].sharePct).toBeNull()
  })
  it('divides by finished weight, so yield loss raises unit costs', () => {
    expect(cogs.perKgFinished).toBeCloseTo(5.25) // 4.20 / 0.8 kg
    expect(cogs.perServing).toBeCloseTo(0.21) // 40 g of 800 g
    expect(cogs.perUnit).toBeCloseTo(2.1)
    expect(cogs.unitsPerBatch).toBe(2)
  })
  it('leaves per-serving and per-unit empty without sizes', () => {
    const c = computeCogs({ lines, costPerKg: id => costs[id] ?? null, finishedWeightG: 800 })
    expect(c.perServing).toBeNull()
    expect(c.perUnit).toBeNull()
    expect(c.unitsPerBatch).toBeNull()
  })
  it('handles an empty formula', () => {
    const c = computeCogs({ lines: [], costPerKg: () => null, finishedWeightG: 0 })
    expect(c).toMatchObject({ batchCost: 0, perKgFinished: null, missingCount: 0 })
  })
})

describe('formatMoney', () => {
  it('keeps extra decimals for small amounts', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    expect(formatMoney(0.214)).toBe('$0.214')
    expect(formatMoney(0.0042)).toBe('$0.0042')
  })
})
