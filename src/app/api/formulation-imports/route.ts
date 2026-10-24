import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { formulationImports } from '@/lib/db/schema'
import { importDraftSchema, missingInfo } from '@/lib/formulation-import'

// The caller's unfinished imports (drafts are private to the person importing)
export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const rows = await db
    .select()
    .from(formulationImports)
    .where(and(eq(formulationImports.accountId, ctx.account.id), eq(formulationImports.userId, ctx.user.id)))
    .orderBy(desc(formulationImports.updatedAt))
  return NextResponse.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    fileName: r.fileName,
    missing: missingInfo(r.draft).vital,
    updatedAt: r.updatedAt,
  })))
}

const bodySchema = z.object({ draft: importDraftSchema })

// Saves an unfinished import as a draft to come back to
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid import draft' }, { status: 400 })
  const { draft } = parsed.data

  const [row] = await db
    .insert(formulationImports)
    .values({
      accountId: ctx.account.id,
      userId: ctx.user.id,
      fileName: draft.fileName,
      name: draft.name.trim() || draft.fileName,
      draft,
    })
    .returning({ id: formulationImports.id })
  return NextResponse.json(row, { status: 201 })
}
