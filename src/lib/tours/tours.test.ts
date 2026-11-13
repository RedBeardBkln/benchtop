import { describe, expect, it } from 'vitest'
import { matchPath, tourForPath, TOUR_MAX_STEPS, TOURS } from './index'

describe('tours', () => {
  it('have unique ids and one to six steps', () => {
    expect(new Set(TOURS.map(t => t.id)).size).toBe(TOURS.length)
    for (const t of TOURS) {
      expect(t.steps.length, t.id).toBeGreaterThan(0)
      expect(t.steps.length, t.id).toBeLessThanOrEqual(TOUR_MAX_STEPS)
      for (const s of t.steps) {
        expect(s.title.trim(), t.id).not.toBe('')
        expect(s.body.trim(), t.id).not.toBe('')
      }
    }
  })
  it('never claim the same path twice', () => {
    const seen = new Map<string, string>()
    for (const t of TOURS) for (const p of t.paths) {
      expect(seen.get(p), `${p} in ${t.id}`).toBeUndefined()
      seen.set(p, t.id)
    }
  })
  it('match path patterns', () => {
    expect(matchPath('/projects/:id', '/projects/abc')).toBe(true)
    expect(matchPath('/projects/:id', '/projects')).toBe(false)
    expect(matchPath('/projects', '/projects/')).toBe(true)
    expect(tourForPath('/projects')?.id).toBe('projects-v1')
    expect(tourForPath('/ingredients/intake')?.id).toBe('lab-intake-v1')
    expect(tourForPath('/ingredients/abc')?.id).toBe('ingredient-detail-v1')
    expect(tourForPath('/nowhere')).toBeNull()
  })
})
