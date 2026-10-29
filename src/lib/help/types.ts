// The Help center's content model. Articles are plain data (not JSX) so the same text renders the
// pages and feeds the search. Inline text supports **bold**, `ui labels` and [links](/path).

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  /** Numbered, do-this-then-that steps */
  | { type: 'steps'; items: string[] }
  /** Bulleted list */
  | { type: 'list'; items: string[] }
  /** Term + explanation pairs (fields, columns, statuses) */
  | { type: 'terms'; items: { term: string; text: string }[] }
  | { type: 'tip' | 'note' | 'warning'; text: string }

export type HelpArticle = {
  /** Anchor on the section page: /help/<section>#<slug> */
  slug: string
  title: string
  /** One line shown in the table of contents and search results */
  summary: string
  blocks: HelpBlock[]
}

export type HelpFaq = { q: string; a: string }

export type HelpSection = {
  slug: string
  title: string
  /** lucide icon name, mapped in the UI */
  icon: HelpIcon
  intro: string
  articles: HelpArticle[]
  faqs: HelpFaq[]
}

export type HelpIcon =
  | 'rocket' | 'folder' | 'flask' | 'beaker' | 'truck' | 'building' | 'users' | 'settings' | 'card' | 'clock' | 'chef' | 'help'
