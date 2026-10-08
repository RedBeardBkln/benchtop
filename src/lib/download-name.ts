// File names for anything the user downloads or saves as PDF:
//   formulation:  "<formulation name>_<iteration number>_<client name>_<date>"
//   NFP panel:    "NFP_<formulation name>_<iteration number>_<client name>_<date>"
// Date is yyyy-MM-dd (local) so files sort chronologically. A formulation with no client simply
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
  formulationName: string
  iteration: number
  clientName?: string | null
  date?: Date
}

function build(prefix: string | null, i: DownloadNameInput): string {
  const parts = [
    prefix,
    cleanPart(i.formulationName) || 'Formulation',
    String(i.iteration),
    cleanPart(i.clientName),
    localDateStamp(i.date),
  ].filter((p): p is string => !!p)
  return parts.join('_')
}

export const formulationFileName = (i: DownloadNameInput) => build(null, i)
export const nfpFileName = (i: DownloadNameInput) => build('NFP', i)
