/**
 * Printable stage props: pilgrim wristbands (Saudi / resident health record),
 * Indonesian KKJH Hajj health cards, and medicine pack labels.
 *
 *   npm run labels        → print/labels.html (open it and print at 100% scale)
 *
 * Everything is read from src/data, so re-run this after the nursing team
 * edits the demo data and the printed codes stay in sync with the app.
 * Invented GTINs (prefix 628-999): these labels are demo props, not real packs.
 */
import bwipjs from 'bwip-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BRAND_COLORS as C, markSvg } from '../src/brand/mark.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = (f) => JSON.parse(readFileSync(join(root, 'src/data', f), 'utf8'))
const drugs = load('drugs.json')
const all = load('patients.json')
/** Saudi citizens and residents: wristband with the national ID / iqama number. */
const patients = all.filter((p) => p.source === 'ehr')
/** Indonesian pilgrims: KKJH card with a QR. */
const pilgrims = all.filter((p) => p.source === 'kkjh')

/** Packs to print, in the order of the stage script. */
const PACKS = [
  { id: 'paracetamol', expiry: '281231', batch: 'L2601' },
  { id: 'metformin', expiry: '281130', batch: 'L2602' },
  { id: 'ibuprofen', expiry: '280930', batch: 'L2603' },
  { id: 'amoxicillin', expiry: '280731', batch: 'L2604' },
  { id: 'augmentin', expiry: '280630', batch: 'L2605' },
  // Backup prop: an expired pack turns any drug red.
  { id: 'paracetamol', expiry: '260131', batch: 'L2512X', expired: true },
]

const FAMILY_AR = { penicillin: 'البنسلين', nsaid: 'مضادات الالتهاب غير الستيرويدية' }

export const svg = (bcid, text, extra = {}) =>
  bwipjs.toSVG({ bcid, text, scale: 3, paddingwidth: 2, paddingheight: 2, ...extra })

export const packPayload = (gtin, p) => `(01)${gtin}(17)${p.expiry}(10)${p.batch}`
export const hajjPayload = (recordNo) => `KKJH:${recordNo}`

const isoExpiry = (yymmdd) => `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`
const logo = markSvg({ mark: C.blue, pulse: C.pulse, dot: C.dot })
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function wristband(p) {
  const allergy = p.allergies.length
    ? `<span class="flag">حساسية: ${p.allergies.map((a) => FAMILY_AR[a.family] ?? a.family).join('، ')}</span>`
    : ''
  return `
  <div class="band">
    <div class="band-code">${svg('code128', p.recordNo, { height: 12, includetext: true, textsize: 9 })}</div>
    <div class="band-info">
      <b>${esc(p.name)}</b>
      <span>${p.age} سنة · ${esc(p.nationality)} · فصيلة ${esc(p.bloodType ?? '—')}</span>
      <span>${esc(p.unit)} · ${esc(p.bed)}</span>
      ${allergy}
    </div>
    <div class="band-logo">${logo}<span>MEDGUARD</span><small>سوار تجريبي</small></div>
  </div>`
}

function hajjCard(p) {
  return `
  <div class="hcard">
    <div class="hcard-head"><span>Kartu Kesehatan Jemaah Haji — KKJH</span><span class="mono">${p.recordNo}</span></div>
    <div class="hcard-body">
      <div class="hcard-photo">صورة<br>الحاج</div>
      <div class="hcard-info">
        <b>${esc(p.name)}</b>
        <span dir="ltr" class="latin">${esc(p.nameLatin)}</span>
        <span>${esc(p.nationality)} · ${p.age} سنة · ${esc(p.bloodType ?? '')}</span>
        <span class="small">${esc(p.campaign)}</span>
      </div>
      <div class="hcard-qr">${svg('qrcode', hajjPayload(p.recordNo), { scale: 2, eclevel: 'M' })}</div>
    </div>
    <div class="hcard-foot">بطاقة تجريبية لعرض MEDGUARD — ليست وثيقة رسمية</div>
  </div>`
}

function packLabel(p) {
  const d = drugs.find((x) => x.id === p.id)
  return `
  <div class="pack${p.expired ? ' expired' : ''}">
    <div class="pack-info">
      <b>${esc(d.nameAr)}</b>
      <span dir="ltr" class="latin">${esc(d.nameEn)} ${esc(d.brandNames.find((b) => /[a-z]/i.test(b)) ? `(${d.brandNames.find((b) => /[a-z]/i.test(b))})` : '')}</span>
      <span class="strength">${esc(d.strength)}</span>
      <span class="small">تنتهي: ${isoExpiry(p.expiry)} · تشغيلة ${p.batch}</span>
      ${p.expired ? '<span class="flag">عبوة منتهية — للعرض فقط</span>' : ''}
    </div>
    <div class="pack-code">
      ${svg('gs1datamatrix', packPayload(d.gtin, p), { scale: 4 })}
      <span dir="ltr" class="hri">(01) ${d.gtin}</span>
    </div>
  </div>`
}

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>MEDGUARD — ملصقات العرض</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif; color: #0F1720; margin: 0; font-size: 10pt; }
  h1 { font-size: 13pt; margin: 0 0 1mm; }
  .hint { color: #5B6675; font-size: 8.5pt; margin: 0 0 5mm; }
  h2 { font-size: 10.5pt; margin: 6mm 0 3mm; color: #0B5FA5; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .small { font-size: 7.5pt; color: #5B6675; }
  .latin { font-size: 8pt; color: #5B6675; }
  .mono { font-family: ui-monospace, monospace; direction: ltr; }
  .flag { display: inline-block; margin-top: 1mm; background: #C62828; color: #fff; border-radius: 1mm; padding: .3mm 1.5mm; font-size: 7.5pt; font-weight: 700; }
  svg { display: block; width: 100%; height: auto; }

  /* Wristband: cut along the dashed border, tape around a wrist. */
  .band { display: flex; align-items: center; gap: 5mm; width: 186mm; height: 26mm; padding: 2mm 5mm;
          border: 1px dashed #9AA4B2; border-radius: 13mm; margin-bottom: 5mm; }
  .band-code { width: 52mm; }
  .band-info { flex: 1; display: flex; flex-direction: column; line-height: 1.35; }
  .band-info b { font-size: 11pt; }
  .band-logo { display: flex; flex-direction: column; align-items: center; font-weight: 700; color: ${C.blue}; font-size: 9pt; line-height: 1.2; }
  .band-logo svg { width: 10mm; margin-bottom: .5mm; }
  .band-logo small { font-weight: 400; color: #5B6675; font-size: 6.5pt; }

  /* Hajj card: ID-1 size (credit card). */
  .cards { display: flex; gap: 6mm; flex-wrap: wrap; }
  .hcard { width: 85.6mm; height: 54mm; border: 1px solid #9AA4B2; border-radius: 3mm; overflow: hidden; display: flex; flex-direction: column; }
  .hcard-head { display: flex; justify-content: space-between; background: #0E6B4F; color: #fff; padding: 1.5mm 3mm; font-size: 8pt; font-weight: 600; }
  .hcard-body { flex: 1; display: flex; gap: 2.5mm; padding: 2.5mm 3mm; align-items: center; }
  .hcard-photo { width: 16mm; height: 20mm; border: 1px dashed #9AA4B2; border-radius: 1mm; display: grid; place-items: center; text-align: center; font-size: 6.5pt; color: #9AA4B2; }
  .hcard-info { flex: 1; display: flex; flex-direction: column; line-height: 1.35; }
  .hcard-info b { font-size: 9.5pt; }
  .hcard-qr { width: 24mm; }
  .hcard-foot { font-size: 6pt; color: #9AA4B2; text-align: center; padding-bottom: 1mm; }

  /* Pack labels: stick onto any small box. */
  .packs { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .pack { display: flex; gap: 3mm; align-items: center; height: 42mm; border: 1px solid #9AA4B2; border-radius: 2mm; padding: 3mm 4mm; }
  .pack.expired { border: 1.5px solid #C62828; }
  .pack-info { flex: 1; display: flex; flex-direction: column; line-height: 1.4; }
  .pack-info b { font-size: 13pt; }
  .strength { font-weight: 600; }
  .pack-code { width: 25mm; text-align: center; }
  .hri { font-family: ui-monospace, monospace; font-size: 6.5pt; color: #5B6675; }
</style>
</head>
<body>
  <section class="page">
    <h1>MEDGUARD — دعائم العرض</h1>
    <p class="hint">اطبعي على A4 بمقياس 100% (بدون "ملاءمة للصفحة"). الرموز مطابقة لبيانات التطبيق في src/data. بيانات وهمية للعرض فقط.</p>
    <h2>أساور الحجاج السعوديين والمقيمين — رقم الهوية/الإقامة (Code 128)</h2>
    ${patients.map(wristband).join('')}
    <h2>بطاقات الحجاج الإندونيسيين KKJH (QR)</h2>
    <div class="cards">${pilgrims.map(hajjCard).join('')}</div>
  </section>
  <section class="page">
    <h2>ملصقات عبوات الأدوية (GS1 DataMatrix)</h2>
    <p class="hint">مع فهد: باراسيتامول (أخضر) ← ميتفورمين (برتقالي: تعديل جرعة) ← إيبوبروفين (برتقالي: تنبيهان يرتبهما Claude) ← أموكسيسيللين (أحمر: حساسية). العبوة المنتهية احتياطية.</p>
    <div class="packs">${PACKS.map(packLabel).join('')}</div>
  </section>
</body>
</html>`

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, 'print/labels.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  console.log(`wrote ${out}`)
}

export { PACKS, drugs, patients, pilgrims }
