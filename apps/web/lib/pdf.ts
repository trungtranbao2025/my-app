// Defer pdfjs-dist import to the browser at runtime to avoid SSR DOM issues

export async function renderPdfPageToCanvas(url: string, pageIndex: number, scale = 1.0): Promise<HTMLCanvasElement> {
  const pdfjsLib: any = await import('pdfjs-dist')
  const pdf = await pdfjsLib.getDocument({ url, disableWorker: true } as any).promise
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvasContext: ctx as any, viewport, canvas } as any).promise
  return canvas
}
