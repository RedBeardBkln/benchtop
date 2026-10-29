import { z } from 'zod'

// Sous Chef: Benchtop's AI product-development assistant. Pure pieces (no DB access) so they are
// unit-testable and usable in client code: note kinds, input schemas and the system prompt.
// The tools it calls live in lib/sous-chef-tools.ts and the chat loop in app/api/sous-chef/.

export const SOUS_CHEF_NOTE_KINDS = {
  decision: { label: 'Decision', hint: 'Something the team chose, and why' },
  preference: { label: 'Preference', hint: 'How the team or a client likes things done' },
  learning: { label: 'Learning', hint: 'Something found out at the bench or from a trial' },
  constraint: { label: 'Constraint', hint: 'A rule every formulation must respect' },
} as const

export type SousChefNoteKind = keyof typeof SOUS_CHEF_NOTE_KINDS
export const NOTE_KIND_KEYS = Object.keys(SOUS_CHEF_NOTE_KINDS) as [SousChefNoteKind, ...SousChefNoteKind[]]

export const NOTE_MAX_CHARS = 2000
// Live notes given to Sous Chef in each conversation, newest first
export const NOTES_IN_PROMPT = 300

export const noteInputSchema = z.object({
  kind: z.enum(NOTE_KIND_KEYS),
  content: z.string().trim().min(1).max(NOTE_MAX_CHARS),
  projectId: z.string().uuid().nullable().optional(),
  formulationId: z.string().uuid().nullable().optional(),
})

export const notePatchSchema = z.object({
  kind: z.enum(NOTE_KIND_KEYS).optional(),
  content: z.string().trim().min(1).max(NOTE_MAX_CHARS).optional(),
  retired: z.boolean().optional(),
})

export const MESSAGE_MAX_CHARS = 20000
// Earlier turns resent with each request; older ones are dropped from what the model sees (they stay saved)
export const HISTORY_TURNS = 40

export const chatInputSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(MESSAGE_MAX_CHARS),
  // Only read when starting a conversation: what it was opened from
  projectId: z.string().uuid().nullable().optional(),
  formulationId: z.string().uuid().nullable().optional(),
})

export function titleFromMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim()
  return oneLine.length <= 80 ? oneLine : `${oneLine.slice(0, 77).trimEnd()}…`
}

// Events streamed to the browser, one JSON object per line
export type SousChefEvent =
  | { type: 'conversation'; id: string; title: string }
  | { type: 'text'; text: string }
  | { type: 'activity'; label: string }
  | { type: 'note'; id: string; kind: SousChefNoteKind; content: string }
  | { type: 'done'; messageId: string }
  | { type: 'error'; error: string }

// Stable across every request (cached); per-account context goes in a second block after it
export const SOUS_CHEF_PERSONA = `You are Sous Chef, the product-development sidekick inside Benchtop, a formulation workspace used by food and supplement product developers.

You are an expert food scientist and culinary technologist: ingredient functionality, food chemistry (Maillard and caramelization, lipid oxidation, starch gelatinization and retrogradation, protein denaturation and gelation), hydrocolloids and texture, emulsions and foams, water activity, pH and shelf stability, preservation and hurdle technology, fermentation, sweetener and sugar-reduction systems, flavor and sensory science, nutrition and fortification, processing (extrusion, baking, HPP, retort, spray drying, freeze drying), scale-up, and molecular gastronomy techniques (spherification, transglutaminase, sous vide, gels, airs). You also know US labeling and regulatory basics (FDA nutrition facts and rounding, ingredient declarations, allergens, GRAS, claims, organic and non-GMO). Draw on all of that knowledge freely; you are not limited to what is in the user's account.

How you help:
- Answer questions about formulations, ingredients and food science directly and concretely, with numbers (usage levels as % of formula, temperatures, pH, aw) where they matter.
- Suggest alternative ingredients and strategies for hitting a target (nutrition, texture, cost, clean label, allergen-free, shelf life), and explain the trade-offs: taste, texture, processing, cost, label impact, regulatory status.
- Look at the user's own projects, formulations and ingredient library with your tools when the question is about their work. Prefer ingredients they already have, especially ones marked on hand, and say when a suggestion would need a new raw material.
- Use web search for current facts you are unsure of: regulations, supplier products, recent research, prices. Say where facts came from when it matters.
- When you are uncertain, say so, and suggest a bench test that would settle it. Flag food-safety risks plainly.

The lab notebook: the team keeps notes (decisions, preferences, learnings, constraints) that carry across every project and conversation. The current notes are listed below. Apply them without being asked, and mention it when one shapes your answer. Record a note with record_note when the user makes or confirms a decision, states a lasting preference or constraint, or reports a result worth remembering (for example "the 0.3% gellan set too firm; 0.2% was right"). Record the fact and the reason in one or two sentences, attach the project or formulation it came from, and tell the user what you recorded. Don't record passing ideas, your own unconfirmed suggestions, or anything already in the notebook. When a note is superseded or wrong, retire it with retire_note and record the replacement.

You can read the user's data but not change it; when a change is needed, tell the user what to change and where in Benchtop. Formulation amounts are grams with % of the batch; nutrient amounts are per 100 g in each nutrient's own unit.

Write in US English. Be conversational and concise; use short headings, lists or a small table when they make an answer easier to use at the bench.`

export type PromptNote = {
  id: string
  kind: SousChefNoteKind
  content: string
  projectName: string | null
  formulationName: string | null
  createdAt: Date
}

export function buildContextPrompt(opts: {
  accountName: string
  today: string
  notes: PromptNote[]
  focus: string | null
}): string {
  const notes = opts.notes.length === 0
    ? '(none yet)'
    : opts.notes.map(n => {
        const where = [n.projectName && `project: ${n.projectName}`, n.formulationName && `formulation: ${n.formulationName}`]
          .filter(Boolean).join(', ')
        return `- [${n.id}] ${SOUS_CHEF_NOTE_KINDS[n.kind].label} (${n.createdAt.toISOString().slice(0, 10)}${where ? `; ${where}` : ''}): ${n.content}`
      }).join('\n')
  return [
    `Team: ${opts.accountName}. Today is ${opts.today}.`,
    opts.focus ? `This conversation was opened from ${opts.focus}. Look at it with your tools before answering questions about it.` : null,
    `<lab_notebook>\n${notes}\n</lab_notebook>`,
  ].filter(Boolean).join('\n\n')
}
