import { NextResponse } from 'next/server'
import { requireApi } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { nutrients } from '@/lib/db/schema'

export async function GET() {
  const auth = await requireApi()
  if (!auth.ok) return auth.res

  const rows = await db.select().from(nutrients).orderBy(nutrients.displayOrder)
  return NextResponse.json(rows)
}
