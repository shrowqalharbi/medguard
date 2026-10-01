import { useState } from 'react'
import { Card, Row, Screen } from '../components/ui'
import { drugs } from '../data'
import { useSession } from '../lib/session'

const RENAL_DRUGS = drugs.filter((d) => d.renal)

type Verdict = { tone: 'safe' | 'warning' | 'critical'; title: string; dose: string; note: string }

function verdict(drugId: string, egfr: number): Verdict {
  const d = RENAL_DRUGS.find((x) => x.id === drugId)!
  const r = d.renal!
  if (r.contraindicatedBelow !== undefined && egfr < r.contraindicatedBelow)
    return { tone: 'critical', title: 'لا يُعطى', dose: '—', note: `ممنوع عند eGFR أقل من ${r.contraindicatedBelow}.` }
  if (r.adjustBelow !== undefined && egfr < r.adjustBelow)
    return { tone: 'warning', title: 'الجرعة المعدّلة', dose: r.adjustedDose!, note: `يُعدَّل عند eGFR أقل من ${r.adjustBelow}.` }
  if (r.avoidBelow !== undefined && egfr < r.avoidBelow)
    return { tone: 'warning', title: 'يُفضّل تجنبه', dose: d.standardDose, note: r.avoidReason ?? '' }
  return { tone: 'safe', title: 'الجرعة القياسية', dose: d.standardDose, note: 'لا يلزم تعديل مع وظائف الكلى الحالية.' }
}

const TONE = {
  safe: 'bg-safe-bg text-safe-fg',
  warning: 'bg-warning-bg text-warning-fg',
  critical: 'bg-critical-bg text-critical-fg',
}

export default function Calculator() {
  const { patient } = useSession()
  const [drugId, setDrugId] = useState(RENAL_DRUGS[0].id)
  const [egfr, setEgfr] = useState(patient?.egfr ? String(patient.egfr.value) : '')

  const value = Number(egfr)
  const valid = egfr.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 150
  const v = valid ? verdict(drugId, value) : null
  const drug = RENAL_DRUGS.find((d) => d.id === drugId)!

  return (
    <Screen title="حاسبة الجرعة الكلوية" back="/home">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="drug" className="text-[13px] text-secondary">
            الدواء
          </label>
          <select
            id="drug"
            value={drugId}
            onChange={(e) => setDrugId(e.target.value)}
            className="h-12 rounded-md border border-line bg-surface px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand/40"
          >
            {RENAL_DRUGS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameAr} {d.strength}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="egfr" className="text-[13px] text-secondary">
            eGFR (مل/دقيقة/1.73م²)
          </label>
          <input
            id="egfr"
            inputMode="numeric"
            dir="ltr"
            value={egfr}
            onChange={(e) => setEgfr(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="مثال: 38"
            aria-invalid={egfr !== '' && !valid}
            className={`h-12 rounded-md border bg-surface px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand/40 ${
              egfr !== '' && !valid ? 'border-critical-solid' : 'border-line'
            }`}
          />
          {patient && (
            <p className="text-[12px] text-tertiary">
              {patient.egfr
                ? `من ملف ${patient.name}: ${patient.egfr.value} (${patient.egfr.measuredAt})`
                : `لا يوجد eGFR في ملف ${patient.name}. أدخلي القيمة بعد وصول التحليل.`}
            </p>
          )}
          {egfr !== '' && !valid && <p className="text-[13px] text-critical-fg">أدخلي قيمة بين 1 و150.</p>}
        </div>

        <Card>
          <Row label="الجرعة القياسية" value={drug.standardDose} />
        </Card>

        {v ? (
          <section className={`flex flex-col items-center gap-1 rounded-md p-5 text-center ${TONE[v.tone]}`} aria-live="polite">
            <p className="text-[13px]">{v.title}</p>
            <p className="text-[22px] font-bold">{v.dose}</p>
            <p className="text-[12px]">{v.note}</p>
          </section>
        ) : (
          <p className="rounded-md bg-surface-2 p-5 text-center text-[13px] text-secondary">أدخلي قيمة eGFR لعرض الجرعة المناسبة.</p>
        )}
      </div>
    </Screen>
  )
}
