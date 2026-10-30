// Pure pieces of the platform admin console, safe in client code

// Usage counts for one account (see getAccountUsage in admin-server.ts)
export type AccountUsage = {
  members: number
  projects: number
  formulations: number
  ingredients: number
  suppliers: number
  clients: number
  timeEntries: number
  sousChefConversations: number
  sousChefMessages30d: number
  documents: number
  changes30d: number
  changes7d: number
  lastSeenAt: string | null
}

// How a platform admin action reads in the activity log (see admin_actions)

const fmtDate = (v: unknown) =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v))
    ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

const PLAN_NAMES: Record<string, string> = { paid: 'Paid', free_lifetime: 'Free for life', free_period: 'Free for a set time' }

function describePlan(p: unknown): string {
  const plan = (p ?? {}) as { plan?: string; freeUntil?: string | null; maxUsers?: number | null }
  const name = PLAN_NAMES[plan.plan ?? ''] ?? plan.plan ?? '?'
  const until = fmtDate(plan.freeUntil)
  if (plan.plan === 'free_lifetime') return plan.maxUsers != null ? `${name} (up to ${plan.maxUsers} users)` : name
  return until ? `${name}, free until ${until}` : name
}

export function describeAdminAction(action: string, details: Record<string, unknown>): string {
  const who = typeof details.email === 'string' ? details.email : 'a person'
  const reason = typeof details.reason === 'string' && details.reason ? ` (${details.reason})` : ''
  switch (action) {
    case 'plan.change': return `Changed plan: ${describePlan(details.from)} → ${describePlan(details.to)}`
    case 'account.suspend': return `Suspended the account${reason}`
    case 'account.restore': return 'Restored the account'
    case 'account.delete': return 'Deleted the account'
    case 'subscription.cancel_at_period_end': return 'Set the subscription to cancel at the end of the period'
    case 'subscription.resume': return 'Undid the subscription’s scheduled cancellation'
    case 'subscription.cancel_now': return 'Canceled the subscription immediately'
    case 'user.suspend': return `Suspended ${who}${reason}`
    case 'user.restore': return `Restored ${who}`
    case 'user.remove': return `Removed ${who} from the account`
    default: return action
  }
}
