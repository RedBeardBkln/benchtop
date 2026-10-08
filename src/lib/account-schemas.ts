import { z } from 'zod'

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
})

export const accountNameSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(120),
})

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().min(3).max(254),
})
