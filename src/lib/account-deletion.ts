import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accountMembers, accounts, activityLog, auditLog, clients, equipment, ingredientDocs, ingredients, intakeItems,
  profiles, projects, sousChefConversations, sousChefNotes, subscriptions, suppliers, timeEntries,
} from '@/lib/db/schema'
import { clearBranding } from '@/lib/logo-server'
import { clearStaging } from '@/lib/staged-upload'
import { needsStripeCancel } from '@/lib/billing/entitlement'
import { BillingNotConfiguredError, getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { DOCS_BUCKET, getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin'

// Permanently deletes an account and everything in it: the owner from Settings, or a platform
// admin. Callers check who may do it and that it isn't the billing-exempt staff account.

export type DeleteAccountResult =
  | { ok: true; loginsRemoved: boolean }
  | { ok: false; status: number; error: string; code?: string }

type Sub = { stripeSubscriptionId: string | null; status: string }

// `subscription`: the account's, when the caller already has it; otherwise it's looked up
export async function deleteAccount(accountId: string, subscription?: Sub | null): Promise<DeleteAccountResult> {
  // Without the service role we could neither delete the logins nor the stored documents:
  // refuse up front instead of half-deleting.
  if (!isAdminConfigured()) {
    return { ok: false, status: 503, error: 'Account deletion is not available in this environment', code: 'admin_not_configured' }
  }

  // 1. Stop billing first. If billing cannot be reached we do not delete (the account would keep
  //    being charged for a workspace that no longer exists).
  const sub = subscription !== undefined
    ? subscription
    : (await db.select().from(subscriptions).where(eq(subscriptions.accountId, accountId)).limit(1))[0]
  // Terminal statuses (canceled, incomplete_expired) have nothing to cancel; skip the Stripe call.
  if (sub?.stripeSubscriptionId && needsStripeCancel(sub)) {
    if (!isBillingConfigured()) {
      return {
        ok: false,
        status: 503,
        error: 'Billing is not configured, so the subscription cannot be canceled. Account not deleted.',
        code: 'billing_not_configured',
      }
    }
    try {
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (err instanceof BillingNotConfiguredError || code !== 'resource_missing') {
        console.error('[account delete] stripe cancel failed:', err)
        return { ok: false, status: 502, error: 'Could not cancel the subscription. Account not deleted.' }
      }
      // resource_missing: already gone on Stripe's side; continue
    }
  }

  // 2. Stored documents (paths are in the DB; objects use either the old or the account-prefixed layout)
  const docRows = await db
    .select({ filePath: ingredientDocs.filePath })
    .from(ingredientDocs)
    .innerJoin(ingredients, eq(ingredientDocs.ingredientId, ingredients.id))
    .where(eq(ingredients.accountId, accountId))
  const admin = getSupabaseAdmin()
  const paths = docRows.map(d => d.filePath)
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(DOCS_BUCKET).remove(paths.slice(i, i + 100))
    if (error) {
      console.error('[account delete] storage removal failed:', error.message)
      return { ok: false, status: 502, error: 'Could not remove stored documents. Account not deleted.' }
    }
  }
  // Uploads that were started but never attached to anything; best effort
  await clearStaging(accountId).catch(err => console.error('[account delete] staging cleanup failed:', err))
  await clearBranding(accountId).catch(err => console.error('[account delete] logo cleanup failed:', err))

  // 3. Database rows, FK-safe, in one transaction.
  //    projects -> cascades formulations, lines, process steps, targets, batch runs, reverse targets
  //    and candidates (clearing the RESTRICT references to ingredients) before ingredients go.
  const members = await db
    .select({ userId: accountMembers.userId })
    .from(accountMembers)
    .where(eq(accountMembers.accountId, accountId))
  const memberIds = members.map(m => m.userId)

  await db.transaction(async tx => {
    await tx.delete(sousChefNotes).where(eq(sousChefNotes.accountId, accountId))
    await tx.delete(sousChefConversations).where(eq(sousChefConversations.accountId, accountId)) // cascades messages
    await tx.delete(timeEntries).where(eq(timeEntries.accountId, accountId))
    await tx.delete(projects).where(eq(projects.accountId, accountId))
    await tx.delete(clients).where(eq(clients.accountId, accountId)) // cascades contacts
    await tx.delete(intakeItems).where(eq(intakeItems.accountId, accountId))
    await tx.delete(ingredients).where(eq(ingredients.accountId, accountId)) // cascades nutrients, allergens, certs, docs, sub-ingredients, supplier links
    await tx.delete(suppliers).where(eq(suppliers.accountId, accountId))
    await tx.delete(equipment).where(eq(equipment.accountId, accountId))
    await tx.delete(auditLog).where(eq(auditLog.accountId, accountId))
    await tx.delete(activityLog).where(eq(activityLog.accountId, accountId))
    await tx.delete(subscriptions).where(eq(subscriptions.accountId, accountId))
    await tx.delete(accountMembers).where(eq(accountMembers.accountId, accountId))
    if (memberIds.length > 0) await tx.delete(profiles).where(inArray(profiles.userId, memberIds))
    await tx.delete(accounts).where(eq(accounts.id, accountId))
  })

  // 4. Logins. A leftover login with no membership has no access (deny by default), so a failure
  //    here is reported but does not undo the deletion.
  let loginsRemoved = true
  for (const userId of memberIds) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      loginsRemoved = false
      console.error('[account delete] deleteUser failed:', error.message)
    }
  }

  return { ok: true, loginsRemoved }
}
