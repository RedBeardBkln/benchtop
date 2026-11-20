import { pgTable, uuid, text, timestamp, index, check, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'
import { projects } from './projects'
import { formulations } from './formulations'

// Sous Chef, the AI product-development assistant (see lib/sous-chef.ts).
// A conversation belongs to the person who started it; only they see it.
export const sousChefConversations = pgTable('sous_chef_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  userId: uuid('user_id').notNull(), // Supabase auth UID
  title: text('title').notNull(),
  // What the conversation is about, filled in down to the level it's linked at: a project; a whole
  // formulation (project + family); or one iteration (all three). See linkScope in lib/sous-chef.ts.
  // The assistant can still look at anything else in the account.
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  // formulations.family_id; no foreign key because it isn't a key (it equals the v1 row's id, which can be deleted)
  formulationFamilyId: uuid('formulation_family_id'),
  formulationId: uuid('formulation_id').references(() => formulations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sous_chef_conversations_user_idx').on(t.accountId, t.userId, t.updatedAt),
])

// One turn of a conversation, as shown in the chat. Only the text is kept; tool calls and web
// lookups made during an assistant turn are summarized in `activity`.
export const sousChefMessages = pgTable('sous_chef_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => sousChefConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  // Short labels of what the assistant did this turn, e.g. "Read formulation Oat Bar v3"
  activity: text('activity').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sous_chef_messages_conversation_idx').on(t.conversationId, t.createdAt),
  check('sous_chef_messages_role_chk', sql`${t.role} in ('user', 'assistant')`),
])

// A change to a formulation Sous Chef proposed in a conversation (see lib/sous-chef-proposals.ts).
// Nothing is written to the formulation until the person approves it in the chat; approval
// re-checks their edit access and that the formulation hasn't changed since (`base_fingerprint`).
export const sousChefProposals = pgTable('sous_chef_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  userId: uuid('user_id').notNull(), // the conversation's owner, the only one who can decide
  conversationId: uuid('conversation_id').notNull().references(() => sousChefConversations.id, { onDelete: 'cascade' }),
  // The assistant turn that made it, once that turn is saved
  messageId: uuid('message_id').references(() => sousChefMessages.id, { onDelete: 'set null' }),
  formulationId: uuid('formulation_id').notNull().references(() => formulations.id, { onDelete: 'cascade' }),
  // The proposed change as Sous Chef gave it (ProposalChanges) and what the card shows (ProposalPreview)
  changes: jsonb('changes').notNull(),
  preview: jsonb('preview').notNull(),
  // sha256 of the formulation's lines, steps and details when proposed
  baseFingerprint: text('base_fingerprint').notNull(),
  status: text('status').notNull().default('pending'), // pending | applied | declined | stale | reverted
  // The iteration the change landed in (a new one, or the same as formulation_id)
  resultFormulationId: uuid('result_formulation_id').references(() => formulations.id, { onDelete: 'set null' }),
  // Saved over the iteration: its lines, steps and details as they were before (RevertSnapshot), so
  // the person can put it back; and the fingerprint just after, to tell whether it was edited since
  snapshot: jsonb('snapshot'),
  appliedFingerprint: text('applied_fingerprint'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  revertedAt: timestamp('reverted_at', { withTimezone: true }),
}, (t) => [
  index('sous_chef_proposals_conversation_idx').on(t.conversationId, t.createdAt),
  index('sous_chef_proposals_formulation_idx').on(t.formulationId),
  check('sous_chef_proposals_status_chk', sql`${t.status} in ('pending', 'applied', 'declined', 'stale', 'reverted')`),
])

// The team's lab notebook: decisions, preferences, learnings and constraints Sous Chef (or a person)
// recorded. Every live note is given to Sous Chef in every later conversation, across all projects;
// a note tied to a project is hidden from members who can't see that project.
export const sousChefNotes = pgTable('sous_chef_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  createdBy: uuid('created_by').notNull(), // Supabase auth UID
  kind: text('kind').notNull(), // a SOUS_CHEF_NOTE_KINDS key
  content: text('content').notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  formulationId: uuid('formulation_id').references(() => formulations.id, { onDelete: 'set null' }),
  // The conversation it was recorded in, if any
  conversationId: uuid('conversation_id').references(() => sousChefConversations.id, { onDelete: 'set null' }),
  // Retired notes (superseded or no longer true) are kept for the record but no longer applied
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sous_chef_notes_account_idx').on(t.accountId, t.createdAt),
  check('sous_chef_notes_kind_chk', sql`${t.kind} in ('decision', 'preference', 'learning', 'constraint')`),
])
