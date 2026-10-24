import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import type { ImportDraft } from '@/lib/formulation-import'

// A formulation read from an uploaded spreadsheet that was saved before it was complete (an
// ingredient, the project or an amount still missing). It isn't a formulation yet: it becomes one
// when the person who imported it finishes it on the import screen. Private to that person.
export const formulationImports = pgTable('formulation_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(), // Supabase auth UID of the person importing
  fileName: text('file_name').notNull(),
  name: text('name').notNull(),
  draft: jsonb('draft').$type<ImportDraft>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('formulation_imports_owner_idx').on(t.accountId, t.userId),
])
