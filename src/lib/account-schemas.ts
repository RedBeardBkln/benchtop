import { z } from 'zod'
import { memberAccessSchema } from './team-access'
import { ACCOUNT_PLANS, MAX_FREE_PERIOD_DAYS, MAX_USER_CAP, MIN_FREE_PERIOD_DAYS } from './billing/plans'

// Shared (client + server) validation for profile and invite-redemption inputs.

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Optional trimmed text: '' / whitespace becomes null
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform(v => (v ? v : null))

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  company: optionalText(120),
  jobTitle: optionalText(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .refine(v => !v || /^\+?[0-9][0-9 ().-]{4,}$/.test(v), 'Enter a valid phone number')
    .transform(v => (v ? v : null)),
  timezone: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .refine(v => !v || isValidTimeZone(v), 'Unknown time zone')
    .transform(v => (v ? v : null)),
})
export type ProfileInput = z.infer<typeof profileSchema>

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)

export const redeemSchema = z.object({
  token: z.string().min(10).max(200),
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  company: optionalText(120),
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: 'You must accept the Terms and Privacy Policy' }),
})
export type RedeemInput = z.infer<typeof redeemSchema>

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  note: z.string().trim().max(500).optional(),
  expiresInDays: z.number().int().min(1).max(60).optional(),
  plan: z.enum(ACCOUNT_PLANS).default('paid'),
  // Required for 'free_period' (how long it stays free from signup); ignored otherwise
  freeDays: z.number().int().max(MAX_FREE_PERIOD_DAYS).optional(),
  // 'free_lifetime' only: cap on additional users; omitted or null = no cap
  maxUsers: z.number().int().min(0).max(MAX_USER_CAP).nullable().optional(),
}).superRefine((v, c) => {
  if (v.plan === 'free_period' && (v.freeDays == null || v.freeDays < MIN_FREE_PERIOD_DAYS)) {
    c.addIssue({ code: 'custom', path: ['freeDays'], message: `A free period must be at least ${MIN_FREE_PERIOD_DAYS} days` })
  }
})

export const accountNameSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(120),
})

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().min(3).max(254),
})

// Team management (owners and admins). `access` only applies to role 'member'.
export const teamInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['admin', 'member']),
  access: memberAccessSchema.optional(),
})

export const teamMemberUpdateSchema = z.object({
  role: z.enum(['admin', 'member']),
  access: memberAccessSchema.optional(),
})

// Platform admin: change an existing account's plan.
//   paid          freeUntil = optional trial end (null = subscription needed now)
//   free_period   freeUntil = required end date, in the future
//   free_lifetime maxUsers  = optional cap on additional users
export const accountPlanUpdateSchema = z.object({
  plan: z.enum(ACCOUNT_PLANS),
  freeUntil: z.string().datetime({ offset: true }).nullable().optional(),
  maxUsers: z.number().int().min(0).max(MAX_USER_CAP).nullable().optional(),
}).superRefine((v, c) => {
  if (v.plan === 'free_period') {
    if (!v.freeUntil) c.addIssue({ code: 'custom', path: ['freeUntil'], message: 'Choose when the free period ends' })
    else if (new Date(v.freeUntil).getTime() <= Date.now()) {
      c.addIssue({ code: 'custom', path: ['freeUntil'], message: 'The free period must end in the future' })
    }
  }
})

// Platform admin: suspend or restore an account or a person
export const adminSuspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
})

// Platform admin: delete an account; the account's name must be typed to confirm
export const adminDeleteAccountSchema = z.object({
  confirmName: z.string().trim().min(1).max(200),
})

// Platform admin: change an account's Stripe subscription
export const ADMIN_SUBSCRIPTION_ACTIONS = ['cancel_at_period_end', 'resume', 'cancel_now'] as const
export const adminSubscriptionSchema = z.object({
  action: z.enum(ADMIN_SUBSCRIPTION_ACTIONS),
})
