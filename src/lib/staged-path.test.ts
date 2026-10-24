import { describe, expect, it } from 'vitest'
import { isOwnStagedPath, stagedFileName } from './staged-path'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

describe('isOwnStagedPath', () => {
  it('accepts a file directly in the account’s staging folder', () => {
    expect(isOwnStagedPath(A, `${A}/_staging/0b7e-spec.pdf`)).toBe(true)
  })
  it('rejects another account’s staging folder', () => {
    expect(isOwnStagedPath(A, `${B}/_staging/x.pdf`)).toBe(false)
  })
  it('rejects real document paths and anything nested or traversing', () => {
    expect(isOwnStagedPath(A, `${A}/ingredient/123-spec.pdf`)).toBe(false)
    expect(isOwnStagedPath(A, `${A}/_staging/../${B}/x.pdf`)).toBe(false)
    expect(isOwnStagedPath(A, `${A}/_staging/sub/x.pdf`)).toBe(false)
    expect(isOwnStagedPath(A, `${A}/_staging/`)).toBe(false)
  })
})

describe('stagedFileName', () => {
  it('drops the staging id', () => {
    expect(stagedFileName(`${A}/_staging/9f8e7d6c-5b4a-3210-fedc-ba9876543210-Spec_Sheet.pdf`)).toBe('Spec_Sheet.pdf')
  })
})
