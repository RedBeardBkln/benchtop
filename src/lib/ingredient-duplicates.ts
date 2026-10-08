import { NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ingredients } from '@/lib/db/schema'
import {
  DUPLICATE_CODE, duplicateMessage, identityKey, normalizePart, type IdentityFields,
} from '@/lib/ingredient-identity'

// Server-side guard for the "no duplicate ingredients" rule. Every route that creates an ingredient,
// or changes its name/brand/supplier/item code, calls findDuplicate() first.

const identityColumns = {
  id: ingredients.id,
  name: ingredients.name,
  brandName: ingredients.brandName,
  supplierName: ingredients.supplierName,
  itemCode: ingredients.itemCode,
}

export type DuplicateMatch = { id: string; name: string; brandName: string | null; supplierName: string | null; itemCode: string | null }

/** The account's existing entry with the same identity as `fields`, if any (ignoring `excludeId`). */
export async function findDuplicate(
  accountId: string,
  fields: IdentityFields,
  excludeId?: string,
): Promise<DuplicateMatch | null> {
  const key = identityKey(fields)
  // Compared in code on the normalised key (SQL can't fold accents/whitespace the same way). Only four
  // short columns per row are read, and only for this account.
  const candidates = await db
    .select(identityColumns)
    .from(ingredients)
    .where(and(eq(ingredients.accountId, accountId), excludeId ? ne(ingredients.id, excludeId) : undefined))
  const wantedName = normalizePart(fields.name)
  return candidates.find(c => normalizePart(c.name) === wantedName && identityKey(c) === key) ?? null
}

/** 409 body shared by every route, so the UI can recognise it by `code`. */
export function duplicateResponse(fields: IdentityFields, existing: DuplicateMatch) {
  return NextResponse.json(
    { error: duplicateMessage(fields), code: DUPLICATE_CODE, existing },
    { status: 409 },
  )
}

export class DuplicateIngredientError extends Error {
  constructor(public fields: IdentityFields, public existing: DuplicateMatch) {
    super(duplicateMessage(fields))
  }
}

/** All identity rows for an account (used to flag pre-existing duplicates). */
export async function loadIdentityRows(accountId: string) {
  return db.select(identityColumns).from(ingredients).where(eq(ingredients.accountId, accountId))
}
