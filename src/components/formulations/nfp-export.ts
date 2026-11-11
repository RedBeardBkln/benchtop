// A drawn Nutrition Facts panel (see nfp-canvas) as a file. Shared by the NFP dialog's download and the
// account export, so both produce the same PNG, JPEG or one-page PDF.

export type NfpFileFormat = 'png' | 'jpg' | 'pdf'

export async function nfpCanvasToBlob(canvas: HTMLCanvasElement, format: NfpFileFormat): Promise<Blob> {
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf')
    // The canvas is drawn at 3× (see drawNfpToCanvas); size the page so the panel prints at its CSS size
    const pxToMm = 25.4 / (96 * 3)
    const w = canvas.width * pxToMm
    const h = canvas.height * pxToMm
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [w, h] })
    // Compressed: stored raw, the 3× panel image makes each PDF over 4 MB
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h, undefined, 'FAST')
    return pdf.output('blob')
  }
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the panel'))), mime, format === 'jpg' ? 0.95 : undefined))
}
