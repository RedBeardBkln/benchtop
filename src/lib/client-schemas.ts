import { z } from 'zod'

// Validation for client records (pure; shared by the API routes and the client editor).

const optText = (max: number) => z.string().trim().max(max).nullable().optional()

export const clientAddressSchema = z.object({
  line1: z.string().trim().max(200).default(''),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().max(120).default(''),
  region: z.string().trim().max(120).default(''),
  postalCode: z.string().trim().max(40).default(''),
  country: z.string().trim().max(120).default(''),
})
export type ClientAddress = z.infer<typeof clientAddressSchema>

export const EMPTY_ADDRESS: ClientAddress = { line1: '', line2: '', city: '', region: '', postalCode: '', country: '' }

export const carrierAccountSchema = z.object({
  carrier: z.string().trim().min(1).max(80),
  accountNumber: z.string().trim().min(1).max(80),
})
export type CarrierAccount = z.infer<typeof carrierAccountSchema>

export const clientFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  website: optText(500),
  notes: optText(5000),
  legalName: optText(255),
  taxId: optText(80),
  paymentTerms: optText(120),
  currency: optText(10),
  poRequired: z.boolean().optional(),
  billingEmail: z.string().trim().email().max(320).nullable().optional().or(z.literal('').transform(() => null)),
  billingAddress: clientAddressSchema.nullable().optional(),
  accountingNotes: optText(5000),
  shippingAddress: clientAddressSchema.nullable().optional(),
  upsAccount: optText(80),
  fedexAccount: optText(80),
  dhlAccount: optText(80),
  otherCarrierAccounts: z.array(carrierAccountSchema).max(20).optional(),
  preferredCarrier: optText(80),
  shippingNotes: optText(5000),
})
export const clientPatchSchema = clientFieldsSchema.partial()
export type ClientFields = z.infer<typeof clientFieldsSchema>

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  title: optText(200),
  email: z.string().trim().email().max(320).nullable().optional().or(z.literal('').transform(() => null)),
  phone: optText(60),
  isPrimary: z.boolean().optional(),
  notes: optText(2000),
})
export const contactPatchSchema = contactSchema.partial()

/** Empty strings become null and an address with nothing filled in is stored as null. */
export function normalizeClientFields<T extends Partial<ClientFields>>(d: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue
    if (typeof v === 'string') out[k] = k === 'name' ? v : v === '' ? null : v
    else if ((k === 'billingAddress' || k === 'shippingAddress') && v && typeof v === 'object') {
      out[k] = Object.values(v as ClientAddress).some(x => x.trim() !== '') ? v : null
    } else out[k] = v
  }
  return out as T
}

