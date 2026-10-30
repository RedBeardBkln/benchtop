import { describe, expect, it } from 'vitest'
import { buildContextPrompt, chatInputSchema, conversationPatchSchema, linkScope, noteInputSchema, titleFromMessage } from './sous-chef'

describe('titleFromMessage', () => {
  it('keeps short messages on one line', () => {
    expect(titleFromMessage('  How do I\nreduce sugar?  ')).toBe('How do I reduce sugar?')
  })

  it('shortens long messages', () => {
    const title = titleFromMessage('word '.repeat(40))
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('buildContextPrompt', () => {
  const base = { accountName: 'Test Kitchen', today: '2026-10-29', focus: null }

  it('says when the notebook is empty', () => {
    expect(buildContextPrompt({ ...base, notes: [] })).toContain('(none yet)')
  })

  it('lists notes with their id, kind, date and where they came from', () => {
    const prompt = buildContextPrompt({
      ...base,
      focus: 'the project “Oat Bar”',
      notes: [{
        id: 'n1', kind: 'decision', content: 'Use allulose, not erythritol, for cooling-free sweetness.',
        projectName: 'Oat Bar', formulationName: 'Base v3', createdAt: new Date('2026-10-20T12:00:00Z'),
      }],
    })
    expect(prompt).toContain('- [n1] Decision (2026-10-20; project: Oat Bar, formulation: Base v3): Use allulose')
    expect(prompt).toContain('is about the project “Oat Bar”')
    expect(prompt).toContain('Team: Test Kitchen. Today is 2026-10-29.')
  })
})

describe('schemas', () => {
  it('rejects an empty message and an unknown note kind', () => {
    expect(chatInputSchema.safeParse({ message: '   ' }).success).toBe(false)
    expect(noteInputSchema.safeParse({ kind: 'idea', content: 'x' }).success).toBe(false)
    expect(noteInputSchema.safeParse({ kind: 'learning', content: ' 0.2% gellan set right ' }).data?.content)
      .toBe('0.2% gellan set right')
  })
})

describe('links', () => {
  const id = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'

  it('takes the most specific stored level as the scope', () => {
    expect(linkScope({ projectId: id, formulationFamilyId: id, formulationId: id })).toBe('iteration')
    expect(linkScope({ projectId: id, formulationFamilyId: id, formulationId: null })).toBe('formulation')
    expect(linkScope({ projectId: id, formulationFamilyId: null, formulationId: null })).toBe('project')
    expect(linkScope({ projectId: null, formulationFamilyId: null, formulationId: null })).toBeNull()
  })

  it('accepts a link, an unlink, or neither, and refuses an unknown scope or a bad id', () => {
    expect(chatInputSchema.safeParse({ message: 'hi', link: { scope: 'formulation', id } }).success).toBe(true)
    expect(conversationPatchSchema.safeParse({ link: null }).success).toBe(true)
    expect(conversationPatchSchema.safeParse({ title: 'Gellan trials' }).data?.link).toBeUndefined()
    expect(conversationPatchSchema.safeParse({ link: { scope: 'batch', id } }).success).toBe(false)
    expect(conversationPatchSchema.safeParse({ link: { scope: 'project', id: 'nope' } }).success).toBe(false)
  })
})
