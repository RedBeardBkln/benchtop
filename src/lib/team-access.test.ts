import { describe, expect, it } from 'vitest'
import {
  accessForRole, canCreateAnyProject, canCreateProject, canEditLibrary, DEFAULT_MEMBER_ACCESS,
  memberAccessSchema, projectAccess, renameClientGrants, summarizeAccess, type MemberAccess,
} from './team-access'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'

const access = (over: Partial<MemberAccess> = {}): MemberAccess => ({ ...DEFAULT_MEMBER_ACCESS, ...over })

describe('projectAccess', () => {
  it('owners and admins (null access) can edit everything', () => {
    expect(projectAccess(null, { id: P1, client: null })).toBe('edit')
    expect(projectAccess(undefined, { id: P1, client: 'Acme' })).toBe('edit')
  })

  it('a new member sees no projects', () => {
    expect(projectAccess(DEFAULT_MEMBER_ACCESS, { id: P1, client: 'Acme' })).toBe('none')
  })

  it('applies the all-projects baseline', () => {
    expect(projectAccess(access({ allProjects: 'view' }), { id: P1, client: null })).toBe('view')
  })

  it('matches client grants case- and whitespace-insensitively', () => {
    const a = access({ clients: [{ client: ' acme ', level: 'edit' }] })
    expect(projectAccess(a, { id: P1, client: 'ACME' })).toBe('edit')
    expect(projectAccess(a, { id: P1, client: 'Other' })).toBe('none')
    expect(projectAccess(a, { id: P1, client: null })).toBe('none')
  })

  it('applies project grants to that project only', () => {
    const a = access({ projects: [{ projectId: P1, level: 'view' }] })
    expect(projectAccess(a, { id: P1, client: null })).toBe('view')
    expect(projectAccess(a, { id: P2, client: null })).toBe('none')
  })

  it('takes the highest applicable level', () => {
    const a = access({
      allProjects: 'view',
      clients: [{ client: 'Acme', level: 'edit' }],
      projects: [{ projectId: P2, level: 'view' }],
    })
    expect(projectAccess(a, { id: P1, client: 'Acme' })).toBe('edit')
    expect(projectAccess(a, { id: P2, client: 'Acme' })).toBe('edit')
    expect(projectAccess(a, { id: P2, client: null })).toBe('view')
  })
})

describe('project creation', () => {
  it('needs edit on all projects or on the chosen client', () => {
    expect(canCreateProject(null, null)).toBe(true)
    expect(canCreateProject(access({ allProjects: 'edit' }), null)).toBe(true)
    expect(canCreateProject(access({ allProjects: 'view' }), null)).toBe(false)
    const a = access({ clients: [{ client: 'Acme', level: 'edit' }, { client: 'Beta', level: 'view' }] })
    expect(canCreateProject(a, 'acme')).toBe(true)
    expect(canCreateProject(a, 'Beta')).toBe(false)
    expect(canCreateProject(a, null)).toBe(false)
  })

  it('a project grant alone never allows creating projects', () => {
    expect(canCreateAnyProject(access({ projects: [{ projectId: P1, level: 'edit' }] }))).toBe(false)
    expect(canCreateAnyProject(access({ clients: [{ client: 'Acme', level: 'edit' }] }))).toBe(true)
    expect(canCreateAnyProject(null)).toBe(true)
  })
})

describe('library access', () => {
  it('is editable for admins and members granted edit', () => {
    expect(canEditLibrary(null)).toBe(true)
    expect(canEditLibrary(access({ library: 'edit' }))).toBe(true)
    expect(canEditLibrary(DEFAULT_MEMBER_ACCESS)).toBe(false)
  })
})

describe('accessForRole', () => {
  it('stores nothing for admins and the default for members without access', () => {
    expect(accessForRole('admin', access({ allProjects: 'edit' }))).toBeNull()
    expect(accessForRole('owner', undefined)).toBeNull()
    expect(accessForRole('member', undefined)).toEqual(DEFAULT_MEMBER_ACCESS)
  })
})

describe('memberAccessSchema', () => {
  it('rejects unknown levels and non-uuid project ids', () => {
    expect(memberAccessSchema.safeParse({ ...DEFAULT_MEMBER_ACCESS, library: 'none' }).success).toBe(false)
    expect(memberAccessSchema.safeParse({ ...DEFAULT_MEMBER_ACCESS, projects: [{ projectId: 'x', level: 'view' }] }).success).toBe(false)
    expect(memberAccessSchema.safeParse(null).success).toBe(false)
    expect(memberAccessSchema.safeParse(DEFAULT_MEMBER_ACCESS).success).toBe(true)
  })
})

describe('summarizeAccess', () => {
  it('describes the grants', () => {
    expect(summarizeAccess(DEFAULT_MEMBER_ACCESS)).toBe('No projects · Library: view')
    expect(
      summarizeAccess(access({
        allProjects: 'view',
        library: 'edit',
        clients: [{ client: 'A', level: 'edit' }, { client: 'B', level: 'view' }],
        projects: [{ projectId: P1, level: 'edit' }],
      })),
    ).toBe('All projects: view · 2 clients · 1 project · Library: edit')
  })
})

describe('renameClientGrants', () => {
  it('follows a client rename, case-insensitively, and reports no-ops', () => {
    const a = access({ clients: [{ client: 'acme ', level: 'edit' }, { client: 'Beta', level: 'view' }] })
    expect(renameClientGrants(a, 'ACME', 'Acme Foods')?.clients).toEqual([
      { client: 'Acme Foods', level: 'edit' },
      { client: 'Beta', level: 'view' },
    ])
    expect(renameClientGrants(a, 'Gamma', 'Delta')).toBeNull()
  })
})
