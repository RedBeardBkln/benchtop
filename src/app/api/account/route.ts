import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { accountNameSchema, deleteAccountSchema } from '@/lib/account-schemas'
import { deleteAccount } from '@/lib/account-deletion'

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

  const result = await deleteAccount(ctx.account.id, ctx.subscription)
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
  return NextResponse.json({ ok: true, loginsRemoved: result.loginsRemoved })
}
