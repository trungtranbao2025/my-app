export function toBinaryMask(canvas: HTMLCanvasElement, threshold = 200): ImageData {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const v = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2]
    const b = v < threshold ? 255 : 0
    data[i] = data[i+1] = data[i+2] = b
    data[i+3] = 255
  }
  return img
}

export function countAndMaskOverlap(a: ImageData, b: ImageData): { count: number; bbox: [number,number,number,number] | null } {
  const w = a.width, h = a.height
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity
  let count = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y*w + x) * 4
      if (a.data[idx] === 255 && b.data[idx] === 255) {
        count++
        if (x < xmin) xmin = x
        if (y < ymin) ymin = y
        if (x > xmax) xmax = x
        if (y > ymax) ymax = y
      }
    }
  }
  if (count === 0) return { count: 0, bbox: null }
  return { count, bbox: [xmin, ymin, xmax, ymax] }
}
