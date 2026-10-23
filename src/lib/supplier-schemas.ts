import { z } from 'zod'
import { clientAddressSchema, contactSchema, type ClientAddress } from './client-schemas'

// Validation for supplier records (pure; shared by the API routes and the supplier editor).
// Addresses and contacts take the same shape as client records.

const optText = (max: number) => z.string().trim().max(max).nullable().optional()
const optEmail = z.string().trim().email().max(320).nullable().optional().or(z.literal('').transform(() => null))

// "example.com" is taken as https://example.com; anything that still isn't a URL is rejected
const optUrl = z.preprocess(
  v => (typeof v === 'string' && v.trim() && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
  z.string().trim().url('Website must be a valid URL').max(500).nullable().optional().or(z.literal('').transform(() => null)),
)

export const supplierFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  websiteUrl: optUrl,
  email: optEmail,
  phone: optText(60),
  address: clientAddressSchema.nullable().optional(),
  accountNumber: optText(80),
  paymentTerms: optText(120),
  notes: optText(5000),
})
export const supplierPatchSchema = supplierFieldsSchema.partial()
export type SupplierFields = z.infer<typeof supplierFieldsSchema>

// A new supplier can come with its first contact
export const supplierCreateSchema = supplierFieldsSchema.extend({
  contact: contactSchema.omit({ isPrimary: true }).nullable().optional(),
})

/** Empty strings become null and an address with nothing filled in is stored as null. */
export function normalizeSupplierFields<T extends Partial<SupplierFields>>(d: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue
    if (typeof v === 'string') out[k] = k === 'name' ? v : v === '' ? null : v
    else if (k === 'address' && v && typeof v === 'object') {
      out[k] = Object.values(v as ClientAddress).some(x => x.trim() !== '') ? v : null
    } else out[k] = v
  }
  return out as T
}

/** One-line address for lists, e.g. "Minneapolis, MN, USA". */
export function shortAddress(a: ClientAddress | null | undefined): string {
  if (!a) return ''
  return [a.city, a.region, a.country].map(s => s?.trim()).filter(Boolean).join(', ')
}
