import { z } from 'zod'

export const FEEDBACK_KINDS = ['bug', 'feature'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
}

export const FEEDBACK_MESSAGE_MAX = 5000

// Only the full name is required on a profile, so a profile with one is complete
export function isProfileComplete(profile: { fullName: string | null } | null | undefined): boolean {
  return !!profile?.fullName?.trim()
}

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1, 'Describe the bug or feature').max(FEEDBACK_MESSAGE_MAX),
  contactName: z.string().trim().min(1, 'Name is required').max(120),
  contactEmail: z.string().trim().email('Enter a valid email').max(254),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .refine(v => !v || /^\+?[0-9][0-9 ().-]{4,}$/.test(v), 'Enter a valid phone number')
    .transform(v => (v ? v : null)),
  wantsContact: z.boolean(),
  pagePath: z.string().max(500).nullish(),
})

export type FeedbackInput = z.infer<typeof feedbackSchema>
