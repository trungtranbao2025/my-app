import fs from 'node:fs'
import path from 'node:path'
import pngToIco from 'png-to-ico'

async function getSharp() {
  try {
    const mod = await import('sharp')
    return mod.default || mod
  } catch (e) {
    console.error('Sharp is required. Run: npm i -D sharp')
    throw e
  }
}

const root = process.cwd()
const srcPng = path.join(root, 'public', 'ibst-logo.png')
const outDir = path.join(root, 'electron', 'build')
const outIco = path.join(outDir, 'icon.ico')

async function main() {
  if (!fs.existsSync(srcPng)) {
    console.error('Source PNG not found:', srcPng)
    console.error('Place your PNG logo at public/ibst-logo.png (suggested 512x512)')
    process.exit(1)
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const sharp = await getSharp()
  const base = sharp(srcPng).png()
  const sizes = [256, 128, 64, 48, 32, 16]
  const buffers = []
  for (const s of sizes) {
    const b = await base.resize(s, s, { fit: 'cover' }).toBuffer()
    buffers.push(b)
  }
  const ico = await pngToIco(buffers)
  fs.writeFileSync(outIco, ico)
  console.log('Generated:', outIco)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
