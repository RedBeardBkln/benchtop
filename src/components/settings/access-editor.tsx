'use client'

import { X } from 'lucide-react'
import type { AccessLevel, ClientRecordsLevel, GrantLevel, MemberAccess } from '@/lib/team-access'

// Edits what a team 'member' can see and change. Admins don't use this (they have full access).

export type ProjectOption = { id: string; name: string; client: string | null }

const selectCls =
  'px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

function LevelSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  tip,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<[T, string]>
  label: string
  tip?: string
}) {
  return (
    <select aria-label={label} data-tip={tip} value={value} onChange={e => onChange(e.target.value as T)} className={selectCls}>
      {options.map(([v, text]) => (
        <option key={v} value={v}>{text}</option>
      ))}
    </select>
  )
}

const GRANT_OPTIONS: Array<[GrantLevel, string]> = [['view', 'Can view'], ['edit', 'Can edit']]
const ALL_OPTIONS: Array<[AccessLevel, string]> = [['none', 'No access'], ['view', 'Can view'], ['edit', 'Can edit']]
const CLIENT_RECORD_OPTIONS: Array<[ClientRecordsLevel, string]> = [
  ['view', 'Can view'],
  ['add', 'Can add'],
  ['edit', 'Can add and edit'],
]

export function AccessEditor({
  value,
  onChange,
  projects,
  clients,
}: {
  value: MemberAccess
  onChange: (next: MemberAccess) => void
  projects: ProjectOption[]
  clients: string[]
}) {
  const grantedClients = new Set(value.clients.map(c => c.client.toLowerCase()))
  const grantedProjects = new Set(value.projects.map(p => p.projectId))
  const projectName = (id: string) => {
    const p = projects.find(x => x.id === id)
    return p ? `${p.name}${p.client ? ` (${p.client})` : ''}` : 'Deleted project'
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-gray-700">All projects</span>
          <LevelSelect
            label="Access to all projects"
            tip="The starting level for every project, including new ones. No access hides them, Can view is read-only, Can edit allows changes. The highest level wins."
            value={value.allProjects}
            onChange={allProjects => onChange({ ...value, allProjects })}
            options={ALL_OPTIONS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-gray-700">Ingredient library &amp; suppliers</span>
          <LevelSelect
            label="Ingredient library access"
            tip="Covers ingredients, suppliers, equipment and lab intake. Everyone can at least view, since formulations need their ingredients."
            value={value.library}
            onChange={library => onChange({ ...value, library })}
            options={GRANT_OPTIONS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-gray-700">Client records</span>
          <LevelSelect
            label="Client records access"
            tip="Contacts, accounting and shipping details on the Clients page. Can view: read them and pick existing clients for projects. Can add: also add new clients and edit the ones they added. Can add and edit: add, edit, archive and delete any client."
            value={value.clientRecords}
            onChange={clientRecords => onChange({ ...value, clientRecords })}
            options={CLIENT_RECORD_OPTIONS}
          />
        </label>
      </div>

      <div>
        <div className="font-medium text-gray-700 mb-1">Clients</div>
        <p className="text-xs text-gray-500 mb-2">Access to every project for that client, including new ones.</p>
        <ul className="space-y-2">
          {value.clients.map((g, i) => (
            <li key={g.client} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-gray-900">{g.client}</span>
              <LevelSelect
                label={`Access to ${g.client}`}
                tip="Can view: open this client’s projects read-only. Can edit: change them. Includes new projects for the client."
                value={g.level}
                onChange={level =>
                  onChange({ ...value, clients: value.clients.map((c, j) => (j === i ? { ...c, level } : c)) })
                }
                options={GRANT_OPTIONS}
              />
              <button
                type="button"
                aria-label={`Remove ${g.client}`}
                data-tip="Remove access to this client’s projects (unless All projects still gives it)"
                onClick={() => onChange({ ...value, clients: value.clients.filter((_, j) => j !== i) })}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        {clients.some(c => !grantedClients.has(c.toLowerCase())) ? (
          <select
            aria-label="Add a client"
            data-tip="Give access to every project for a client, including future ones. It starts at Can view."
            value=""
            onChange={e => {
              if (e.target.value) onChange({ ...value, clients: [...value.clients, { client: e.target.value, level: 'view' }] })
            }}
            className={`${selectCls} mt-2 w-full sm:w-auto`}
          >
            <option value="">+ Add a client…</option>
            {clients.filter(c => !grantedClients.has(c.toLowerCase())).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          clients.length === 0 && <p className="text-xs text-gray-400">No projects have a client yet.</p>
        )}
      </div>

      <div>
        <div className="font-medium text-gray-700 mb-1">Specific projects</div>
        <ul className="space-y-2">
          {value.projects.map((g, i) => (
            <li key={g.projectId} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-gray-900">{projectName(g.projectId)}</span>
              <LevelSelect
                label={`Access to ${projectName(g.projectId)}`}
                tip="Can view: open this project read-only. Can edit: change it."
                value={g.level}
                onChange={level =>
                  onChange({ ...value, projects: value.projects.map((p, j) => (j === i ? { ...p, level } : p)) })
                }
                options={GRANT_OPTIONS}
              />
              <button
                type="button"
                aria-label={`Remove ${projectName(g.projectId)}`}
                data-tip="Remove access to this project (unless All projects or its client still gives it)"
                onClick={() => onChange({ ...value, projects: value.projects.filter((_, j) => j !== i) })}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        {projects.some(p => !grantedProjects.has(p.id)) && (
          <select
            aria-label="Add a project"
            data-tip="Give access to one project. It starts at Can view."
            value=""
            onChange={e => {
              if (e.target.value) {
                onChange({ ...value, projects: [...value.projects, { projectId: e.target.value, level: 'view' }] })
              }
            }}
            className={`${selectCls} mt-2 w-full sm:w-auto max-w-full`}
          >
            <option value="">+ Add a project…</option>
            {projects.filter(p => !grantedProjects.has(p.id)).map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.client ? ` (${p.client})` : ''}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
