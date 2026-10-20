// Compress a photo client-side before upload — phone camera shots can be 8-15 MB,
// which exceeds Vercel's 4.5 MB serverless request body limit.
export function compressImage(file: File, maxBytes = 1.4 * 1024 * 1024): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 2048
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      let quality = 0.88
      const tryBlob = () => {
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return }
          if (blob.size <= maxBytes || quality < 0.3) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else { quality -= 0.15; tryBlob() }
        }, 'image/jpeg', quality)
      }
      tryBlob()
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
