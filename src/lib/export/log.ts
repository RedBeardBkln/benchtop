import { after } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dataExports } from '@/lib/db/schema'
import type { ExportChoices } from './model'
import { errorSummary } from './error-summary'

// The data export log the platform admin reviews (see dataExports in db/schema/admin.ts).
// An export is recorded as it starts and completed when it ends, so one the platform kills at its time
// limit still shows (as never finished). Logging never fails or delays an export: the start is one quick
// insert whose failure is only reported, and everything after it is written once the response has gone.

export type ExportStart = {
  accountId: string
  userId: string
  kind: 'files' | 'json'
  choices?: ExportChoices
}

export type ExportFinish = {
  status: 'succeeded' | 'failed'
  summary?: Record<string, number>
  bytes?: number
  durationMs: number
  error?: unknown
  stagedPath?: string
}

/** Record that an export began; null when it couldn't be recorded (the export goes ahead regardless) */
export async function logExportStart(entry: ExportStart): Promise<string | null> {
  try {
    const [row] = await db.insert(dataExports).values({
      accountId: entry.accountId,
      userId: entry.userId,
      kind: entry.kind,
      status: 'started',
      choices: entry.choices ?? null,
    }).returning({ id: dataExports.id })
    return row.id
  } catch (e) {
    console.error('[export] could not log the export start', e)
    return null
  }
}

/** Complete the record once the response has been sent */
export function logExportFinish(id: string | null, finish: ExportFinish): void {
  if (!id) return
  after(async () => {
    try {
      await db.update(dataExports).set({
        status: finish.status,
        summary: finish.summary ?? {},
        bytes: finish.bytes ?? null,
        durationMs: Math.round(finish.durationMs),
        error: finish.error === undefined ? null : errorSummary(finish.error),
        stagedPath: finish.stagedPath ?? null,
        finishedAt: new Date(),
      }).where(eq(dataExports.id, id))
    } catch (e) {
      console.error('[export] could not log the export result', e)
    }
  })
}

/** The browser has the staged zip (it removes the staged copy next): record when, after the response */
export function logExportDownloaded(accountId: string, stagedPath: string): void {
  after(async () => {
    try {
      await db.update(dataExports)
        .set({ downloadedAt: new Date() })
        .where(and(eq(dataExports.accountId, accountId), eq(dataExports.stagedPath, stagedPath), isNull(dataExports.downloadedAt)))
    } catch (e) {
      console.error('[export] could not log the download', e)
    }
  })
}
