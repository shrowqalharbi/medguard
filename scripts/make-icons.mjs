/**
 * App icons from the brand mark in src/brand/mark.ts.
 *
 *   npm run icons   → public/favicon.svg, favicon.ico, apple-touch-icon.png,
 *                     icon-192.png, icon-512.png, icon-maskable-512.png
 *
 * PNGs are rasterised by a headless Chromium (scripts/browser.mjs).
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAND_COLORS as C, markSvg } from '../src/brand/mark.ts'
import { launch } from './browser.mjs'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const onBlue = { mark: C.white, pulse: C.white, dot: C.dot }

/**
 * Mark drawn at `scale` of the icon on a blue background.
 * `radius` is the corner radius as a fraction of the side (0 = full-bleed square).
 */
function icon({ scale, radius }) {
  const side = 64 / scale
  const o = 32 - side / 2
  const bg = `<rect x="${o}" y="${o}" width="${side}" height="${side}" rx="${side * radius}" fill="${C.blue}"/>`
  return markSvg(onBlue, { viewBox: `${o} ${o} ${side} ${side}`, inner: bg })
}

const rounded = icon({ scale: 0.84, radius: 0.22 })
const square = icon({ scale: 0.8, radius: 0 })
// Maskable: launchers may crop to a circle of 80% diameter, so keep the mark well inside it.
const maskable = icon({ scale: 0.62, radius: 0 })

const PNGS = [
  { file: 'apple-touch-icon.png', svg: square, size: 180 },
  { file: 'icon-192.png', svg: rounded, size: 192, transparent: true },
  { file: 'icon-512.png', svg: rounded, size: 512, transparent: true },
  { file: 'icon-maskable-512.png', svg: maskable, size: 512 },
]
const ICO_SIZES = [16, 32, 48]

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size % 256, e)
    head.writeUInt8(size % 256, e + 1)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(buf.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += buf.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.buf)])
}

const page = (svg, size) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)

writeFileSync(join(pub, 'favicon.svg'), rounded + '\n')
console.log('wrote public/favicon.svg')

const browser = await launch()
try {
  for (const p of PNGS) {
    writeFileSync(join(pub, p.file), await browser.shot(page(p.svg, p.size), { width: p.size, height: p.size, transparent: p.transparent }))
    console.log(`wrote public/${p.file}`)
  }
  const small = []
  for (const size of ICO_SIZES) {
    small.push({ size, buf: await browser.shot(page(rounded, size), { width: size, height: size, transparent: true }) })
  }
  writeFileSync(join(pub, 'favicon.ico'), ico(small))
  console.log('wrote public/favicon.ico')
} finally {
  await browser.close()
}
