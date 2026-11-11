// A format-neutral picture of an export: spreadsheets (for Excel) and reports (for Word and PDF).
// The builders in build.ts fill these from the account data; the renderers turn them into files.
// Pure, so the export dialog can import the category list.

import type { NfpModel } from '@/lib/nfp-model'

export type DocFormat = 'xlsx' | 'docx' | 'pdf'
export type PanelFormat = 'pdf' | 'jpg' | 'png'
export type AnyFormat = DocFormat | PanelFormat

export const FORMAT_LABEL: Record<AnyFormat, string> = { xlsx: 'Excel', docx: 'Word', pdf: 'PDF', jpg: 'JPEG', png: 'PNG' }

/** What each part of the export is saved as. The first option of each category is its default. */
export const EXPORT_CATEGORIES = {
  projects: {
    label: 'Projects and clients',
    options: ['xlsx', 'docx', 'pdf'],
    hint: {
      xlsx: 'One workbook: projects, client records and contacts, nutrition targets, time entries and the team',
      docx: 'One document of every project and client',
      pdf: 'One document of every project and client',
    },
  },
  formulations: {
    label: 'Formulations',
    options: ['xlsx', 'docx', 'pdf'],
    hint: {
      xlsx: 'One workbook per formulation, one tab per iteration',
      docx: 'One document per formulation, a section per iteration',
      pdf: 'One document per formulation, a section per iteration',
    },
  },
  suppliers: {
    label: 'Suppliers and ingredients',
    options: ['xlsx', 'docx', 'pdf'],
    hint: {
      xlsx: 'One workbook: suppliers and contacts, the ingredients they supply, a tab of all ingredients, and lab intake',
      docx: 'One document: suppliers, then every ingredient',
      pdf: 'One document: suppliers, then every ingredient',
    },
  },
  sousChef: {
    label: 'Sous Chef',
    options: ['pdf', 'docx'],
    hint: { pdf: 'Your conversations and the team lab notebook', docx: 'Your conversations and the team lab notebook' },
  },
  nfp: {
    label: 'Nutrition Facts panels',
    options: ['pdf', 'jpg', 'png'],
    hint: {
      pdf: 'Each saved panel, or a standard panel for iterations without one',
      jpg: 'Each saved panel, or a standard panel for iterations without one',
      png: 'Each saved panel, or a standard panel for iterations without one',
    },
  },
} as const satisfies Record<string, { label: string; options: readonly AnyFormat[]; hint: Partial<Record<AnyFormat, string>> }>

export type ExportCategory = keyof typeof EXPORT_CATEGORIES
export type ExportChoices = { [K in ExportCategory]: (typeof EXPORT_CATEGORIES)[K]['options'][number] }

export const DEFAULT_CHOICES = Object.fromEntries(
  Object.entries(EXPORT_CATEGORIES).map(([k, c]) => [k, c.options[0]]),
) as ExportChoices

export type Cell = string | number | boolean | Date | null | undefined

export type Column = {
  label: string
  /** Relative width in a report table; spreadsheets size columns to their content */
  width?: number
  /** Right-aligned in reports */
  numeric?: boolean
}

/** A sheet that is one table, with a filterable header row */
export type Sheet = { name: string; columns: Column[]; rows: Cell[][] }

/** A sheet laid out as a page: a title, label/value fields and titled tables stacked down it */
export type Section =
  | { t: 'title'; text: string }
  | { t: 'fields'; fields: Array<[label: string, value: Cell]> }
  | { t: 'table'; title: string; columns: Column[]; rows: Cell[][]; emptyText?: string }
export type SectionSheet = { name: string; sections: Section[] }

export type Workbook = { path: string; sheets: Array<Sheet | SectionSheet> }

export type Block =
  | { t: 'h1' | 'h2' | 'h3'; text: string }
  | { t: 'p'; text: string; muted?: boolean; mono?: boolean }
  | { t: 'bullets'; items: string[]; numbered?: boolean }
  | { t: 'fields'; fields: Array<[label: string, value: string]> }
  | { t: 'table'; columns: Column[]; rows: string[][]; emptyText?: string }
  | { t: 'pagebreak' }

/**
 * Whether a table row, field or list item is short enough to keep in one piece on a page.
 * Longer ones (a long note or instruction) are allowed to split, or they'd be cut off at the page foot.
 */
export const fitsOnPage = (texts: string[]) => texts.reduce((n, t) => n + t.length, 0) < 900

export type Report = { path: string; title: string; subtitle?: string; blocks: Block[] }

/** One file of the export, before rendering; `path` has no extension */
export type ExportFile =
  | { kind: 'workbook'; book: Workbook }
  | { kind: 'report'; report: Report; format: 'docx' | 'pdf' }

/** A Nutrition Facts panel the browser draws (with the app's own panel code) and adds to the zip */
export type PanelJob = {
  /** Path inside the zip's root folder, with extension */
  path: string
  /** A saved panel's model as saved, or a standard panel built from the iteration's nutrition */
  model: NfpModel
}
