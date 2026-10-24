import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApi } from '@/lib/auth/context'
import { AiRefusalError } from '@/lib/ai-json'
import { AdminNotConfiguredError } from '@/lib/supabase/admin'
import { isOwnStagedPath, readStaged, removeStaged, stagedFileName } from '@/lib/staged-upload'
import { MAX_SHEET_TEXT, SpreadsheetError, spreadsheetToText } from '@/lib/spreadsheet-text'
import { buildDrafts, extractFormulations } from '@/lib/formulation-import-server'

// Reading a large workbook can take a minute or two
export const maxDuration = 300

const bodySchema = z.object({
  // Where the browser uploaded the file (see lib/staged-upload); it's deleted once read
  stagedPath: z.string().min(1).max(512),
})

// Reads an uploaded spreadsheet and proposes one import draft per formulation found in it.
// Nothing is saved here; the person reviews the draft first.
export async function POST(req: NextRequest) {
  const auth = await requireApi()
  if (!auth.ok) return auth.res
  const { ctx } = auth

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  const { stagedPath } = parsed.data
  if (!isOwnStagedPath(ctx.account.id, stagedPath)) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  const fileName = stagedFileName(stagedPath)

  let file: Awaited<ReturnType<typeof readStaged>>
  try {
    file = await readStaged(stagedPath)
    await removeStaged(stagedPath)
  } catch (err) {
    if (err instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: 'File storage is not configured', code: 'storage_not_configured' }, { status: 503 })
    }
    throw err
  }
  if (!file) return NextResponse.json({ error: 'Upload not found or too large (max 20 MB)' }, { status: 422 })

  try {
    const sheets = await spreadsheetToText(file.bytes, fileName)
    if (sheets.reduce((n, s) => n + s.text.length, 0) > MAX_SHEET_TEXT) {
      return NextResponse.json(
        { error: 'That file has too much in it to read at once. Copy the formulation onto its own sheet or into a CSV, and upload that.' },
        { status: 422 },
      )
    }
    const found = await extractFormulations(sheets, fileName)
    if (found.length === 0) {
      return NextResponse.json({ error: 'No formulation was found in that file. Check it lists ingredients with amounts.' }, { status: 422 })
    }
    return NextResponse.json({ fileName, drafts: await buildDrafts(ctx, fileName, found) })
  } catch (err) {
    if (err instanceof SpreadsheetError) return NextResponse.json({ error: err.message }, { status: 422 })
    if (err instanceof AiRefusalError) return NextResponse.json({ error: 'The file couldn’t be read automatically.' }, { status: 422 })
    console.error('[formulation-imports/parse]', err)
    return NextResponse.json({ error: 'Reading the file failed. Please try again.' }, { status: 500 })
  }
}
