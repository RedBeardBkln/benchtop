// File names for anything the user downloads or saves as PDF:
//   formulation:  "<formulation name>_<iteration number>_<client name>_<date>"
//   NFP panel:    "NFP_<project name>_<formulation name>_<iteration number>_<client name>_<date>"
//   time report:  "Time report_<client name>_<first day>_to_<last day>" (or "_<date>" with no period)
// Date is yyyy-MM-dd (local) so files sort chronologically. A missing project or client simply
// leaves that segment out rather than leaving a gap.

const MAX_PART = 60

// Characters Windows/macOS/Linux don't allow in file names (plus control characters)
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g

function cleanPart(s: string | null | undefined): string {
  return (s ?? '')
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PART)
    .replace(/[. ]+$/g, '') // Windows drops trailing dots/spaces
}

export function localDateStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type DownloadNameInput = {
  // Only NFP names include the project
  projectName?: string | null
  formulationName: string
  iteration: number
  clientName?: string | null
  date?: Date
}

function build(prefix: string | null, i: DownloadNameInput, withProject = false): string {
  const parts = [
    prefix,
    withProject ? cleanPart(i.projectName) : null,
    cleanPart(i.formulationName) || 'Formulation',
    String(i.iteration),
    cleanPart(i.clientName),
    localDateStamp(i.date),
  ].filter((p): p is string => !!p)
  return parts.join('_')
}

export const formulationFileName = (i: DownloadNameInput) => build(null, i)
export const nfpFileName = (i: DownloadNameInput) => build('NFP', i, true)

/** A saved panel's name as a download file name (same clean-up as the generated names) */
export function savedNameFileName(name: string): string {
  return name.replace(ILLEGAL, ' ').replace(/\s+/g, ' ').trim().slice(0, 150).replace(/[. ]+$/g, '') || 'NFP'
}

export function timeReportFileName(i: { clientName: string; from?: string | null; to?: string | null }): string {
  const period = i.from && i.to ? [i.from, 'to', i.to] : [localDateStamp()]
  return ['Time report', cleanPart(i.clientName) || 'Client', ...period].join('_')
}
