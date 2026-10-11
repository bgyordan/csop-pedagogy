// Снимка от компютъра/телефона → умален JPEG dataURL (за чернови, PDF и малки снимки в базата).

export async function fileToDataUrl(f: File, maxSide = 700, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(f)
  try {
    const i = await new Promise<HTMLImageElement>((ok, fail) => {
      const im = new Image()
      im.onload = () => ok(im)
      im.onerror = fail
      im.src = url
    })
    const k = Math.min(1, maxSide / Math.max(i.naturalWidth, i.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(i.naturalWidth * k)
    c.height = Math.round(i.naturalHeight * k)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(i, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', quality)
  } finally { URL.revokeObjectURL(url) }
}
