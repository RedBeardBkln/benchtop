import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireApi, type AuthContext } from '@/lib/auth/context'
import { DOCS_BUCKET, getSupabaseAdmin } from '@/lib/supabase/admin'
import { loadExportData } from '@/lib/export/data'
import { makeClock } from '@/lib/export/build'
import { buildExportArchive } from '@/lib/export/archive'
import { EXPORT_CATEGORIES, exportsAnything, type ExportChoices } from '@/lib/export/model'
import { logExportDownloaded, logExportFinish, logExportStart } from '@/lib/export/log'
import { EXPORT_BUCKET, removeStagedExports } from '@/lib/export/staging'

import { db } from '@/lib/db'
import {
  accountMembers, batchRuns, feedback, formulationImports, clientContacts, clients, equipment, formulationLines, formulationNfpPanels, formulationNotes, formulations, formulationTargets,
  ingredientAllergens, ingredientCerts, ingredientDocs, ingredientNutrients, ingredientSuppliers,
  ingredients, intakeItems, nutrients, processSteps, profiles, projects, reverseCandidates, reverseTargets,
  subIngredients, supplierContacts, suppliers, timeEntries,
} from '@/lib/db/schema'

// The account owner's data exports, both owner only and available without an active subscription
// (people must be able to get their data out):
//   GET    the whole account as one JSON file, for machines
//   POST   a zip of Excel, Word, PDF and image files, a format chosen (or skipped) per part (see lib/export)
//   DELETE the staged copy of that zip, once the browser has it
// Every export is logged for the platform admin (lib/export/log.ts).
//
// The hosting platform rejects response bodies over ~4.5 MB, so the zip is staged in a private bucket only
// the server can reach (it holds the owner's private Sous Chef conversations) and downloaded from a
// short-lived signed URL. Anything left behind is swept after an hour.

export const runtime = 'nodejs'
export const maxDuration = 300

const URL_SECONDS = 600
const STALE_MS = 60 * 60 * 1000

// One format per category, each limited to that category's options
const choicesSchema = z.object(Object.fromEntries(
  Object.entries(EXPORT_CATEGORIES).map(([k, c]) => [k, z.enum(c.options as unknown as [string, ...string[]])]),
)) as unknown as z.ZodType<ExportChoices>
const inputSchema = z.object({ choices: choicesSchema, timeZone: z.string().max(64).optional() })

async function ensureExportBucket(admin: SupabaseClient) {
  const { data } = await admin.storage.getBucket(EXPORT_BUCKET)
  if (data) return
  const { error } = await admin.storage.createBucket(EXPORT_BUCKET, { public: false })
  if (error && !/exist|duplicate/i.test(error.message)) throw new Error(`Could not set up export storage: ${error.message}`)
}

/** Shown to the owner: the problem in plain words, never a raw database or storage message */
class ExportError extends Error {}

export async function POST(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = inputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a format for each part of the export.' }, { status: 400 })
  const { choices, timeZone } = parsed.data
  if (!exportsAnything(choices)) return NextResponse.json({ error: 'Every part is skipped: choose at least one to export.' }, { status: 400 })

  const started = Date.now()
  const logId = await logExportStart({ accountId: ctx.account.id, userId: ctx.user.id, kind: 'files', choices })
  try {
    const admin = getSupabaseAdmin()
    await ensureExportBucket(admin)
    await removeStagedExports(ctx.account.id, new Date(Date.now() - STALE_MS)).catch(e => console.warn('[export] sweep failed', e))
    // Staged under the account, so one account's files never share a folder with another's
    const staging = admin.storage.from(EXPORT_BUCKET)

    const data = await loadExportData(ctx)
    const clock = makeClock(timeZone ?? ctx.profile?.timezone ?? undefined)
    const archive = await buildExportArchive({
      data,
      choices,
      clock,
      dateStamp: clock.wall(data.generatedAt)!.toISOString().slice(0, 10),
      // Only this account's documents reach here (loadExportData reads them through its ingredients)
      fetchDoc: async path => {
        const { data: blob, error } = await admin.storage.from(DOCS_BUCKET).download(path)
        return error || !blob ? null : new Uint8Array(await blob.arrayBuffer())
      },
    })

    const path = `${ctx.account.id}/${crypto.randomUUID()}.zip`
    const { error: uploadError } = await staging.upload(path, archive.bytes, { contentType: 'application/zip', upsert: false })
    if (uploadError) throw new ExportError(`Could not store the export for download (${uploadError.message})`)

    const { data: signed, error: signError } = await staging.createSignedUrl(path, URL_SECONDS, { download: archive.fileName })
    if (signError || !signed) {
      await staging.remove([path])
      throw new ExportError(`Could not prepare the download (${signError?.message ?? 'no URL'})`)
    }

    logExportFinish(logId, { status: 'succeeded', summary: archive.summary, bytes: archive.bytes.length, durationMs: Date.now() - started, stagedPath: path })
    return NextResponse.json({
      url: signed.signedUrl, path, fileName: archive.fileName, root: archive.root, bytes: archive.bytes.length,
      // Drawn by the browser with the editor's own panel code, then added to the zip
      panels: { format: choices.nfp, jobs: archive.panels },
    })
  } catch (e) {
    console.error('[export]', e)
    logExportFinish(logId, { status: 'failed', durationMs: Date.now() - started, error: e })
    const message = e instanceof ExportError ? e.message.replace(/ \(.*\)$/, '.') : 'The export failed. Try again, or contact support if it keeps happening.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const path = req.nextUrl.searchParams.get('path') ?? ''
  // Only this account's staged exports, and nothing that climbs out of the folder
  if (!path.startsWith(`${auth.ctx.account.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // The browser has the file, whatever happens to the staged copy
  logExportDownloaded(auth.ctx.account.id, path)
  const { error } = await getSupabaseAdmin().storage.from(EXPORT_BUCKET).remove([path])
  if (error) {
    // It stays until the next export's sweep
    console.error('[export] could not remove the staged copy', error.message)
    return NextResponse.json({ error: 'Could not remove the staged copy' }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}

// Full JSON export of the caller's account. Owner only. Stays available without an active
// subscription (people must be able to get their data out). Every query is anchored to the
// account's root rows, so no other account's rows can appear.

export async function GET() {
  const auth = await requireApi({ allowUnentitled: true, role: 'owner' })
  if (!auth.ok) return auth.res
  const { ctx } = auth
  const started = Date.now()
  const logId = await logExportStart({ accountId: ctx.account.id, userId: ctx.user.id, kind: 'json' })
  try {
    const { body, summary } = await jsonExport(ctx)
    logExportFinish(logId, { status: 'succeeded', summary, bytes: Buffer.byteLength(body), durationMs: Date.now() - started })
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="benchtop-export-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[export] json', e)
    logExportFinish(logId, { status: 'failed', durationMs: Date.now() - started, error: e })
    return NextResponse.json({ error: 'The export failed. Try again, or contact support if it keeps happening.' }, { status: 500 })
  }
}

async function jsonExport(ctx: AuthContext): Promise<{ body: string; summary: Record<string, number> }> {
  const accountId = ctx.account.id

  const [
    projectRows, formulationRows, ingredientRows, supplierRows, equipmentRows, memberRows, intakeRows, clientRows,
    contactRows, supplierContactRows,
  ] = await Promise.all([
    db.select().from(projects).where(eq(projects.accountId, accountId)),
    db.select().from(formulations).where(eq(formulations.accountId, accountId)),
    db.select().from(ingredients).where(eq(ingredients.accountId, accountId)),
    db.select().from(suppliers).where(eq(suppliers.accountId, accountId)),
    db.select().from(equipment).where(eq(equipment.accountId, accountId)),
    db
      .select({ userId: accountMembers.userId, role: accountMembers.role, fullName: profiles.fullName })
      .from(accountMembers)
      .leftJoin(profiles, eq(profiles.userId, accountMembers.userId))
      .where(eq(accountMembers.accountId, accountId)),
    db.select().from(intakeItems).where(eq(intakeItems.accountId, accountId)),
    db.select().from(clients).where(eq(clients.accountId, accountId)),
    db.select({ r: clientContacts }).from(clientContacts)
      .innerJoin(clients, eq(clientContacts.clientId, clients.id))
      .where(eq(clients.accountId, accountId)),
    db.select({ r: supplierContacts }).from(supplierContacts)
      .innerJoin(suppliers, eq(supplierContacts.supplierId, suppliers.id))
      .where(eq(suppliers.accountId, accountId)),
  ])

  const [
    lineRows, stepRows, targetRows, runRows, reverseTargetRows, reverseCandidateRows,
    nutrientRows, allergenRows, certRows, subIngredientRows, docRows, supplierLinkRows, nfpPanelRows, noteRows,
  ] = await Promise.all([
    db.select({ r: formulationLines }).from(formulationLines)
      .innerJoin(formulations, eq(formulationLines.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: processSteps }).from(processSteps)
      .innerJoin(formulations, eq(processSteps.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: formulationTargets }).from(formulationTargets)
      .innerJoin(formulations, eq(formulationTargets.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: batchRuns }).from(batchRuns)
      .innerJoin(formulations, eq(batchRuns.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: reverseTargets }).from(reverseTargets)
      .innerJoin(projects, eq(reverseTargets.projectId, projects.id))
      .where(eq(projects.accountId, accountId)),
    db.select({ r: reverseCandidates }).from(reverseCandidates)
      .innerJoin(reverseTargets, eq(reverseCandidates.reverseTargetId, reverseTargets.id))
      .innerJoin(projects, eq(reverseTargets.projectId, projects.id))
      .where(eq(projects.accountId, accountId)),
    db.select({ r: ingredientNutrients, nutrientName: nutrients.name, nutrientUnit: nutrients.unit })
      .from(ingredientNutrients)
      .innerJoin(ingredients, eq(ingredientNutrients.ingredientId, ingredients.id))
      .innerJoin(nutrients, eq(ingredientNutrients.nutrientId, nutrients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientAllergens }).from(ingredientAllergens)
      .innerJoin(ingredients, eq(ingredientAllergens.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientCerts }).from(ingredientCerts)
      .innerJoin(ingredients, eq(ingredientCerts.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: subIngredients }).from(subIngredients)
      .innerJoin(ingredients, eq(subIngredients.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientDocs }).from(ingredientDocs)
      .innerJoin(ingredients, eq(ingredientDocs.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: ingredientSuppliers }).from(ingredientSuppliers)
      .innerJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
      .where(eq(ingredients.accountId, accountId)),
    db.select({ r: formulationNfpPanels }).from(formulationNfpPanels)
      .innerJoin(formulations, eq(formulationNfpPanels.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
    db.select({ r: formulationNotes }).from(formulationNotes)
      .innerJoin(formulations, eq(formulationNotes.formulationId, formulations.id))
      .where(eq(formulations.accountId, accountId)),
  ])

  const feedbackRows = await db.select().from(feedback).where(eq(feedback.accountId, accountId))
  const importRows = await db.select().from(formulationImports).where(eq(formulationImports.accountId, accountId))
  const timeRows = await db.select().from(timeEntries).where(eq(timeEntries.accountId, accountId))

  const sub = ctx.subscription
  const payload = {
    exportedAt: new Date().toISOString(),
    note: 'Document and logo files are not included; ingredientDocs and the logo fields list their storage paths.',
    account: {
      id: ctx.account.id,
      name: ctx.account.name,
      createdAt: ctx.account.createdAt,
      billingExempt: ctx.account.billingExempt,
      teamLogoPath: ctx.account.logoPath,
    },
    subscription: sub
      ? {
          status: sub.status,
          priceId: sub.priceId,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    profile: ctx.profile
      ? {
          email: ctx.user.email ?? null,
          fullName: ctx.profile.fullName,
          company: ctx.profile.company,
          jobTitle: ctx.profile.jobTitle,
          phone: ctx.profile.phone,
          timezone: ctx.profile.timezone,
          logoPath: ctx.profile.logoPath,
          termsVersion: ctx.profile.termsVersion,
          termsAcceptedAt: ctx.profile.termsAcceptedAt,
          privacyVersion: ctx.profile.privacyVersion,
          privacyAcceptedAt: ctx.profile.privacyAcceptedAt,
        }
      : { email: ctx.user.email ?? null },
    members: memberRows,
    clients: clientRows,
    clientContacts: contactRows.map(x => x.r),
    projects: projectRows,
    formulations: formulationRows,
    formulationLines: lineRows.map(x => x.r),
    processSteps: stepRows.map(x => x.r),
    formulationTargets: targetRows.map(x => x.r),
    batchRuns: runRows.map(x => x.r),
    formulationNfpPanels: nfpPanelRows.map(x => x.r),
    formulationNotes: noteRows.map(x => x.r),
    reverseTargets: reverseTargetRows.map(x => x.r),
    reverseCandidates: reverseCandidateRows.map(x => x.r),
    ingredients: ingredientRows,
    intakeItems: intakeRows,
    ingredientNutrients: nutrientRows.map(x => ({ ...x.r, nutrientName: x.nutrientName, nutrientUnit: x.nutrientUnit })),
    ingredientAllergens: allergenRows.map(x => x.r),
    ingredientCerts: certRows.map(x => x.r),
    subIngredients: subIngredientRows.map(x => x.r),
    ingredientDocs: docRows.map(x => x.r),
    suppliers: supplierRows,
    supplierContacts: supplierContactRows.map(x => x.r),
    ingredientSuppliers: supplierLinkRows.map(x => x.r),
    equipment: equipmentRows,
    feedback: feedbackRows,
    // Spreadsheet imports saved before they were finished
    formulationImports: importRows,
    // Billable time logged against clients
    timeEntries: timeRows,
  }

  return {
    body: JSON.stringify(payload, null, 2),
    summary: {
      projects: projectRows.length, formulations: formulationRows.length, ingredients: ingredientRows.length,
      clients: clientRows.length, suppliers: supplierRows.length, timeEntries: timeRows.length, documentsListed: docRows.length,
    },
  }
}
