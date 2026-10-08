import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import {
  accountMembers, accounts, auditLog, equipment, ingredientDocs, ingredients, profiles,
  projects, subscriptions, suppliers,
} from '@/lib/db/schema'
import { accountNameSchema, deleteAccountSchema } from '@/lib/account-schemas'
import { needsStripeCancel } from '@/lib/billing/entitlement'
import { BillingNotConfiguredError, getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { DOCS_BUCKET, getSupabaseAdmin, isAdminConfigured } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = accountNameSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const [row] = await db
    .update(accounts)
    .set({ name: parsed.data.name })
    .where(eq(accounts.id, ctx.account.id))
    .returning({ id: accounts.id, name: accounts.name })

  return NextResponse.json(row)
}

// Permanently deletes the caller's account and everything in it. Owner only; refused for the
// billing-exempt legacy (staff) account.
export async function DELETE(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  if (ctx.account.billingExempt) {
    return NextResponse.json(
      { error: 'This account cannot be deleted from the app', code: 'account_protected' },
      { status: 403 },
    )
  }

  const parsed = deleteAccountSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Confirmation email is required' }, { status: 400 })
  if (parsed.data.confirmEmail.toLowerCase() !== (ctx.user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'The email you typed does not match your account email', code: 'confirm_mismatch' }, { status: 400 })
  }

  // Without the service role we could neither delete the login nor the stored documents:
  // refuse up front instead of half-deleting.
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Account deletion is not available in this environment', code: 'admin_not_configured' },
      { status: 503 },
    )
  }

  const accountId = ctx.account.id

  // 1. Stop billing first. If billing cannot be reached we do not delete (the user would keep
  //    being charged for a workspace that no longer exists).
  const sub = ctx.subscription
  // Terminal statuses (canceled, incomplete_expired) have nothing to cancel; skip the Stripe call.
  if (sub?.stripeSubscriptionId && needsStripeCancel(sub)) {
    if (!isBillingConfigured()) {
      return NextResponse.json(
        { error: 'Billing is not configured, so the subscription cannot be cancelled. Account not deleted.', code: 'billing_not_configured' },
        { status: 503 },
      )
    }
    try {
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (err instanceof BillingNotConfiguredError || code !== 'resource_missing') {
        console.error('[account delete] stripe cancel failed:', err)
        return NextResponse.json({ error: 'Could not cancel the subscription. Account not deleted.' }, { status: 502 })
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
      return NextResponse.json({ error: 'Could not remove stored documents. Account not deleted.' }, { status: 502 })
    }
  }

  // 3. Database rows, FK-safe, in one transaction.
  //    projects -> cascades formulations, lines, process steps, targets, batch runs, reverse targets
  //    and candidates (clearing the RESTRICT references to ingredients) before ingredients go.
  const members = await db
    .select({ userId: accountMembers.userId })
    .from(accountMembers)
    .where(eq(accountMembers.accountId, accountId))
  const memberIds = members.map(m => m.userId)

  await db.transaction(async tx => {
    await tx.delete(projects).where(eq(projects.accountId, accountId))
    await tx.delete(ingredients).where(eq(ingredients.accountId, accountId)) // cascades nutrients, allergens, certs, docs, sub-ingredients, supplier links
    await tx.delete(suppliers).where(eq(suppliers.accountId, accountId))
    await tx.delete(equipment).where(eq(equipment.accountId, accountId))
    await tx.delete(auditLog).where(eq(auditLog.accountId, accountId))
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

  return NextResponse.json({ ok: true, loginsRemoved })
}
