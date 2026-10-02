import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Button, Card, Row, Screen } from '../components/ui'
import { CONDITION_AR, SOURCE_AR, findDrugById } from '../data'
import { familyLabel } from '../engine/checks'
import { loadEvents, type Outcome } from '../lib/events'
import { useSession } from '../lib/session'

const OUTCOME: Record<Outcome, { text: string; cls: string }> = {
  given: { text: 'أُعطي', cls: 'bg-safe-bg text-safe-fg' },
  'given-adjusted': { text: 'جرعة معدّلة', cls: 'bg-warning-bg text-warning-fg' },
  'given-with-reason': { text: 'أُعطي مع سبب', cls: 'bg-warning-bg text-warning-fg' },
  blocked: { text: 'أُوقف', cls: 'bg-critical-bg text-critical-fg' },
  escalated: { text: 'أُبلغ الطبيب', cls: 'bg-critical-bg text-critical-fg' },
  cancelled: { text: 'أُلغي', cls: 'bg-surface-2 text-secondary' },
}

export default function PatientProfile() {
  const { patient } = useSession()

  if (!patient) {
    return (
      <Screen title="ملف الحاج" back="/home" footer={<Link to="/scan/patient"><Button icon="scan">مسح سوار الحاج أو بطاقته</Button></Link>}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-tertiary">
            <Icon name="user" size={26} />
          </span>
          <p className="text-[15px] font-medium">لم يُحدَّد حاج بعد</p>
          <p className="max-w-[260px] text-[13px] leading-6 text-secondary">امسحي سوار الحاج أو بطاقته الصحية لعرض ملفه الحرج وسجل الفحوصات.</p>
        </div>
      </Screen>
    )
  }

  const history = loadEvents().filter((e) => e.patientId === patient.id).slice(0, 8)
  const meds = patient.currentMeds.map((id) => findDrugById(id)?.nameAr ?? id)

  return (
    <Screen title="ملف الحاج" back="/home">
      <div className="flex flex-col gap-3">
        <Card className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
            <Icon name="user" size={24} />
          </span>
          <div>
            <p className="text-base font-semibold">{patient.name}</p>
            <p className="text-[12px] text-secondary">
              {patient.age} سنة · {patient.nationality} · {patient.source === 'kkjh' ? 'KKJH' : 'هوية'} {patient.recordNo}
            </p>
          </div>
        </Card>

        <Card className="py-2">
          <Row label="الطبيب المعالج" value={patient.attendingDoctor} />
          <Row label="الموقع" value={`${patient.unit} · ${patient.bed}`} />
        </Card>

        <p className="flex items-start gap-2 rounded-md bg-brand-subtle p-3 text-[13px] leading-6 text-brand">
          <Icon name="idCard" size={18} className="mt-0.5 shrink-0" />
          المصدر: {SOURCE_AR[patient.source]}.{patient.language ? ` لغة الحاج: ${patient.language}.` : ''}
        </p>

        <Card>
          <h2 className="mb-1 text-[13px] font-semibold text-secondary">الملف الحرج</h2>
          <Row
            label="الحساسيات المسجلة"
            value={
              patient.allergies.length ? (
                <span className="text-critical-fg">
                  {patient.allergies.map((a) => `${familyLabel(a.family)} — ${a.reaction}`).join('، ')}
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
                <span className="text-warning-fg">⚠️ قراءة الكلى مفقودة — اطلبي تحليل كلى</span>
              )
            }
          />
          <Row
            label="أمراض مزمنة"
            value={patient.conditions.length ? patient.conditions.map((c) => CONDITION_AR[c] ?? c).join('، ') : 'لا يوجد'}
          />
          <Row label="الأدوية الحالية" value={meds.length ? meds.join('، ') : 'لا يوجد'} />
        </Card>

        <Card>
          <h2 className="mb-2 text-[13px] font-semibold text-secondary">سجل الفحوصات</h2>
          {history.length === 0 ? (
            <p className="py-2 text-[13px] text-secondary">لم تُمسح أدوية لهذا الحاج بعد.</p>
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
