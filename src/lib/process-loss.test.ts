import { describe, expect, it } from 'vitest'
import { computeProcessYield, describeStepLoss, simulateProcess, stepLosses, toLossStep } from './process-loss'
import { lossFields, lossFieldsError } from './process-loss-fields'

describe('two losses on one step', () => {
  // Centrifuge: 60% of the yogurt's weight comes off as whey (moisture), then 7% of what's left stays in the bowl
  const centrifuge = { lossType: 'moisture', lossAmount: 60, lossUnit: 'pct', loss2Type: 'production', loss2Amount: 7, loss2Unit: 'pct' }

  it('applies them in the order entered, the second taken from what is left', () => {
    const y = computeProcessYield(1000, [centrifuge])
    expect(y.moistureLossG).toBeCloseTo(600)
    expect(y.productionLossG).toBeCloseTo(28) // 7% of 400 g
    expect(y.finishedWeightG).toBeCloseTo(372)
    expect(y.yieldPct).toBeCloseTo(37.2)
    // Production loss takes nutrients with it; only the moisture loss concentrates
    expect(y.concentrationYieldPct).toBeCloseTo(40)
  })

  it('gives a different result in the other order', () => {
    const y = computeProcessYield(1000, [{
      lossType: 'production', lossAmount: 7, lossUnit: 'pct', loss2Type: 'moisture', loss2Amount: 60, loss2Unit: 'pct',
    }])
    expect(y.productionLossG).toBeCloseTo(70)
    expect(y.moistureLossG).toBeCloseTo(558) // 60% of 930 g
    expect(y.finishedWeightG).toBeCloseTo(372)
    expect(y.concentrationYieldPct).toBeCloseTo(40)
  })

  it('matches the same losses split over two steps', () => {
    const one = simulateProcess(1000, [centrifuge])
    const two = simulateProcess(1000, [
      { lossType: 'moisture', lossAmount: 60, lossUnit: 'pct' },
      { lossType: 'production', lossAmount: 7, lossUnit: 'pct' },
    ])
    expect(one.finishedWeightG).toBeCloseTo(two.finishedWeightG)
    expect(one.keptFromStart).toBeCloseTo(two.keptFromStart)
  })

  it('caps the second loss at what is left', () => {
    const y = computeProcessYield(100, [{ lossType: 'moisture', lossAmount: 80, lossUnit: 'g', loss2Type: 'production', loss2Amount: 50, loss2Unit: 'g' }])
    expect(y.finishedWeightG).toBe(0)
    expect(y.productionLossG).toBeCloseTo(20)
  })

  it('reads the second loss from a DB row and describes both', () => {
    const row = { lossType: 'moisture', lossAmount: '60', lossUnit: 'pct', loss2Type: 'production', loss2Amount: '7', loss2Unit: 'pct' }
    expect(stepLosses(toLossStep(row))).toEqual([
      { type: 'moisture', amount: 60, unit: 'pct' },
      { type: 'production', amount: 7, unit: 'pct' },
    ])
    expect(describeStepLoss(row)).toBe('Moisture loss: 60%, then production loss: 7%')
  })
})

describe('loss fields', () => {
  it('moves a second loss up when there is no first', () => {
    expect(lossFields({ lossType: null, loss2Type: 'production', loss2Amount: 7, loss2Unit: 'pct' })).toEqual({
      lossType: 'production', lossAmount: '7', lossUnit: 'pct', loss2Type: null, loss2Amount: null, loss2Unit: 'g',
    })
  })

  it('clears the second loss when it is left out', () => {
    expect(lossFields({ lossType: 'moisture', lossAmount: 10, lossUnit: 'pct' })).toMatchObject({ loss2Type: null, loss2Amount: null })
  })

  it('validates the second loss', () => {
    expect(lossFieldsError({ lossType: 'moisture', lossAmount: 10, lossUnit: 'pct', loss2Type: 'production', loss2Amount: 120, loss2Unit: 'pct' }))
      .toBe('A percentage loss cannot exceed 100%')
    expect(lossFieldsError({ lossType: 'moisture', lossAmount: 10, loss2Type: 'production' })).toBe('Enter the second loss amount greater than 0')
  })
})
