import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { AiBadge, Button, Card, Row, Screen } from '../components/ui'
import { CONDITION_AR, findDrugById } from '../data'
import type { NoteSignal } from '../engine'
import { loadEvents, type Outcome } from '../lib/events'
import { patientSignals } from '../lib/notes'
import { useSession } from '../lib/session'

const FAMILY_AR: Record<string, string> = { penicillin: 'البنسلين', nsaid: 'مضادات الالتهاب', cephalosporin: 'السيفالوسبورين' }

const OUTCOME: Record<Outcome, { text: string; cls: string }> = {
  given: { text: 'أُعطي', cls: 'bg-safe-bg text-safe-fg' },
  'given-adjusted': { text: 'جرعة معدّلة', cls: 'bg-renal-bg text-renal-fg' },
  'given-with-reason': { text: 'أُعطي مع سبب', cls: 'bg-interaction-bg text-interaction-fg' },
  blocked: { text: 'أُوقف', cls: 'bg-critical-bg text-critical-fg' },
  escalated: { text: 'أُبلغ الطبيب', cls: 'bg-critical-bg text-critical-fg' },
  cancelled: { text: 'أُلغي', cls: 'bg-surface-2 text-secondary' },
}

export default function PatientProfile() {
  const { patient } = useSession()
  const [signals, setSignals] = useState<NoteSignal[] | null>(null)

  useEffect(() => {
    if (patient) void patientSignals(patient).then(setSignals)
  }, [patient])

  if (!patient) {
    return (
      <Screen title="ملف المريض" back="/home" footer={<Link to="/scan/patient"><Button icon="scan">مسح سوار المريض</Button></Link>}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-tertiary">
            <Icon name="user" size={26} />
          </span>
          <p className="text-[15px] font-medium">لم يُحدَّد مريض بعد</p>
          <p className="max-w-[260px] text-[13px] leading-6 text-secondary">امسحي سوار المريض لعرض حساسياته وملاحظاته وجرعات اليوم.</p>
        </div>
      </Screen>
    )
  }

  const flagged = (text: string) => signals?.find((s) => text.includes(s.quote.trim()))
  const history = loadEvents().filter((e) => e.patientId === patient.id).slice(0, 8)
  const meds = patient.currentMeds.map((id) => findDrugById(id)?.nameAr ?? id)

  return (
    <Screen title="ملف المريض" back="/home">
      <div className="flex flex-col gap-3">
        <Card className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
            <Icon name="user" size={24} />
          </span>
          <div>
            <p className="text-base font-semibold">{patient.name}</p>
            <p className="text-[12px] text-secondary">
              {patient.hajj
                ? `${patient.age} سنة · بطاقة حاج ${patient.hajj.pilgrimId} · ${patient.hajj.nationality}`
                : `${patient.age} سنة · سوار ${patient.wristband} · غرفة ${patient.room}`}
            </p>
          </div>
        </Card>

        {patient.hajj && (
          <p className="flex items-start gap-2 rounded-md bg-brand-subtle p-3 text-[13px] leading-6 text-brand">
            <Icon name="idCard" size={18} className="mt-0.5 shrink-0" />
            البيانات مقروءة من بطاقة الحاج ولم يُفتح له ملف في المستشفى بعد. اللغة: {patient.hajj.language}.
          </p>
        )}

        <Card>
          <h2 className="mb-1 text-[13px] font-semibold text-secondary">البيانات السريرية</h2>
          <Row
            label={patient.hajj ? 'الحساسيات (من البطاقة)' : 'الحساسيات المسجلة'}
            value={
              patient.allergies.length ? (
                <span className="text-critical-fg">
                  {patient.allergies.map((a) => `${FAMILY_AR[a.family] ?? a.family} — ${a.reaction}`).join('، ')}
                </span>
              ) : (
                'لا يوجد'
              )
            }
          />
          <Row label="فصيلة الدم" value={patient.bloodType ?? '—'} />
          <Row
            label="آخر eGFR"
            value={
              patient.egfr ? (
                `${patient.egfr.value} مل/د — ${patient.egfr.measuredAt}`
              ) : (
                <span className="text-renal-fg">غير متوفر — اطلبي تحليل كلى</span>
              )
            }
          />
          {!!patient.conditions?.length && (
            <Row label="أمراض مزمنة" value={patient.conditions.map((c) => CONDITION_AR[c] ?? c).join('، ')} />
          )}
          <Row label="الأدوية الحالية" value={meds.length ? meds.join('، ') : 'لا يوجد'} />
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-secondary">ملاحظات سريرية ({patient.clinicalNotes.length})</h2>
            {signals === null ? (
              <span className="text-[12px] text-tertiary">جارٍ التحليل…</span>
            ) : (
              <AiBadge label="حلّلها MEDGUARD" />
            )}
          </div>
          {patient.clinicalNotes.length === 0 && (
            <p className="py-2 text-[13px] text-secondary">
              {patient.hajj ? 'لا توجد ملاحظات سريرية: أول زيارة للمستشفى.' : 'لا توجد ملاحظات سريرية.'}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {[...patient.clinicalNotes]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((n) => {
                const s = flagged(n.text)
                return (
                  <li
                    key={n.date + n.text}
                    className={`rounded-md p-3 text-[13px] leading-6 ${s ? 'border border-critical-border bg-critical-bg' : 'bg-surface-2'}`}
                  >
                    {s && (
                      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-critical-fg">
                        <Icon name="alert" size={14} />
                        حساسية محتملة لـ{FAMILY_AR[s.family] ?? s.family} — غير مسجلة رسمياً
                      </p>
                    )}
                    <p className="text-tertiary">
                      {n.date} · {n.author}
                    </p>
                    <p>{n.text}</p>
                  </li>
                )
              })}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-[13px] font-semibold text-secondary">سجل الفحوصات</h2>
          {history.length === 0 ? (
            <p className="py-2 text-[13px] text-secondary">لم تُمسح أدوية لهذا المريض بعد.</p>
          ) : (
            <ul className="flex flex-col">
              {history.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-[13px]">
                  <span>
                    {e.drugName}
                    <span className="ms-2 text-tertiary">
                      {new Date(e.at).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${OUTCOME[e.outcome].cls}`}>
                    {OUTCOME[e.outcome].text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Screen>
  )
}
