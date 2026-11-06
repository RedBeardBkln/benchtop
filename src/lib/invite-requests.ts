import { z } from 'zod'

// Beta invitation requests from the public site. Pure rules shared by the form, the public API and
// the admin list.

export const INVITE_COMPANY_TYPES = [
  'brand',
  'co_manufacturer',
  'consultant',
  'startup',
  'foodservice',
  'education',
  'other',
] as const
export type InviteCompanyType = (typeof INVITE_COMPANY_TYPES)[number]

export const INVITE_COMPANY_TYPE_LABELS: Record<InviteCompanyType, string> = {
  brand: 'Food or beverage brand',
  co_manufacturer: 'Co-manufacturer or co-packer',
  consultant: 'Product development consultant',
  startup: 'Early-stage startup',
  foodservice: 'Restaurant or foodservice',
  education: 'University or research lab',
  other: 'Something else',
}

export const INVITE_TEAM_SIZES = ['1', '2-5', '6-20', '21+'] as const
export type InviteTeamSize = (typeof INVITE_TEAM_SIZES)[number]

export const INVITE_TEAM_SIZE_LABELS: Record<InviteTeamSize, string> = {
  '1': 'Just me',
  '2-5': '2 to 5 people',
  '6-20': '6 to 20 people',
  '21+': 'More than 20',
}

export const INVITE_REQUEST_STATUSES = ['new', 'invited', 'declined'] as const
export type InviteRequestStatus = (typeof INVITE_REQUEST_STATUSES)[number]

export const INVITE_MESSAGE_MAX = 2000

// The form also sends `website`, a field hidden from people. Bots fill it in; anything there means
// the request is dropped (while still answering as if it worked).
export const inviteRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  company: z.string().trim().max(160).nullish().transform(v => v || null),
  role: z.string().trim().max(120).nullish().transform(v => v || null),
  companyType: z.enum(INVITE_COMPANY_TYPES).nullish().transform(v => v ?? null),
  teamSize: z.enum(INVITE_TEAM_SIZES).nullish().transform(v => v ?? null),
  message: z.string().trim().max(INVITE_MESSAGE_MAX).nullish().transform(v => v || null),
  referral: z.string().trim().max(200).nullish().transform(v => v || null),
  consent: z.literal(true, { error: 'Please agree so we can contact you about the beta' }),
  website: z.string().max(500).optional(),
})

export type InviteRequestInput = z.infer<typeof inviteRequestSchema>

export function isBotSubmission(input: { website?: string }): boolean {
  return !!input.website?.trim()
}

// The admin note an invitation created from a request starts with
export function inviteNoteFor(req: { name: string; company: string | null }): string {
  return `Beta request: ${req.name}${req.company ? `, ${req.company}` : ''}`.slice(0, 500)
}
