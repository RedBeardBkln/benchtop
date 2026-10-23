// Versioned legal-document metadata. Bump the version + effective date whenever the text of
// /legal/terms or /legal/privacy changes; the version a user accepted is stored on their profile.
// A second revision on the same day gets a suffix, e.g. 2026-10-23.2.
// NOTE: the draft text is NOT legal advice and needs review before real customers are onboarded.

export const TERMS_VERSION = '2026-10-23.2'
export const TERMS_EFFECTIVE_DATE = 'October 23, 2026'

export const PRIVACY_VERSION = '2026-10-23'
export const PRIVACY_EFFECTIVE_DATE = 'October 23, 2026'

export const LEGAL_ENTITY_NAME = 'Benchtop, LLC'
export const LEGAL_CONTACT_EMAIL = 'legal@benchtop.com'
export const LEGAL_JURISDICTION = 'the State of Delaware, United States'

export const LEGAL_DRAFT_NOTICE = 'Draft -- pending legal review'

// Every user must have accepted the current version of both documents before using the app. A
// missing profile (or an older version) means they have to accept again.
export function needsLegalAcceptance(
  profile: { termsVersion: string | null; privacyVersion: string | null } | null | undefined,
): boolean {
  return profile?.termsVersion !== TERMS_VERSION || profile?.privacyVersion !== PRIVACY_VERSION
}
