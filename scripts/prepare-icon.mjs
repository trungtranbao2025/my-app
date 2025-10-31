import fs from 'node:fs'
import path from 'node:path'

async function getSharp() {
  try {
    const mod = await import('sharp')
    return mod.default || mod
  } catch (e) {
    console.error('Sharp is not installed. Run: npm i -D sharp')
    throw e
  }
}

async function main() {
  const root = process.cwd()
  const src = path.join(root, 'public', 'ibst-logo.png')
  if (!fs.existsSync(src)) {
    console.error('Missing public/ibst-logo.png. Place your logo there first.')
    process.exit(1)
  }
  const sharp = await getSharp()
  const image = sharp(src)
  const meta = await image.metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  const size = Math.max(w, h)
  const padLeft = Math.floor((size - w) / 2)
  const padRight = size - w - padLeft
  const padTop = Math.floor((size - h) / 2)
  const padBottom = size - h - padTop
  const out = await image
    .extend({ top: padTop, bottom: padBottom, left: padLeft, right: padRight, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(512, 512, { fit: 'fill' })
    .png()
    .toBuffer()
  fs.writeFileSync(src, out)
  console.log('Prepared square logo at', src)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
