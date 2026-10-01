import { Navigate, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Button, Card, Row, Screen } from '../components/ui'
import { CONDITION_AR, SOURCE_AR, findDrugById } from '../data'
import { familyLabel } from '../engine/checks'
import { useSession } from '../lib/session'

/**
 * The pilgrim's critical health profile, read from their record, confirmed by
 * the nurse before any drug is scanned. Only the five fields the checks need
 * are fetched, never the whole file.
 */
export default function PilgrimCard() {
  const navigate = useNavigate()
  const { patient, setPatient } = useSession()

  if (!patient) return <Navigate to="/scan/patient" replace />

  const kkjh = patient.source === 'kkjh'
  const meds = patient.currentMeds.map((id) => findDrugById(id)?.nameAr ?? id)

  return (
    <Screen
      title={kkjh ? 'بطاقة الحاج الصحية' : 'ملف الحاج'}
      back="/scan/patient"
      onBack={() => (setPatient(null), navigate('/scan/patient'))}
      footer={
        <>
          <Button icon="pill" onClick={() => navigate('/scan/drug')}>
            تأكيد الهوية ومسح الدواء
          </Button>
          <Button variant="secondary" onClick={() => (setPatient(null), navigate('/scan/patient'))}>
            ليس هذا الحاج
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Identity */}
        <section className="overflow-hidden rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between bg-brand px-4 py-2.5 text-brand-on">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
              <Icon name="idCard" size={18} />
              {kkjh ? 'KKJH — إندونيسيا' : patient.nationality === 'سعودي' ? 'هوية وطنية' : 'إقامة'}
            </span>
            <span dir="ltr" className="font-mono text-[12px] opacity-90">
              {patient.recordNo}
            </span>
          </div>
          <div className="p-4">
            <p className="text-lg font-semibold">{patient.name}</p>
            {patient.nameLatin && (
              <p dir="ltr" className="text-end text-[13px] text-secondary">
                {patient.nameLatin}
              </p>
            )}
            <div className="mt-2 border-t border-line pt-1.5">
              <Row label="الجنسية" value={patient.nationality} />
              <Row label="العمر" value={`${patient.age} سنة`} />
              <Row label="الموقع" value={`${patient.unit} · ${patient.bed}`} />
              {patient.campaign && <Row label="البعثة" value={patient.campaign} />}
              {patient.emergencyContact && <Row label="للتواصل" value={patient.emergencyContact} />}
            </div>
          </div>
        </section>

        {patient.language && (
          <p className="flex items-start gap-2 rounded-md bg-brand-subtle p-3 text-[13px] leading-6 text-brand">
            <Icon name="globe" size={18} className="mt-0.5 shrink-0" />
            لغة الحاج: {patient.language}. تأكدي من الهوية بالصورة في البطاقة، واستعيني بمرشد البعثة عند الحاجة.
          </p>
        )}

        <ProfileCard />

        <p className="flex items-start gap-2 px-1 text-[12px] leading-5 text-tertiary">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
          قُرئ من {SOURCE_AR[patient.source]} بمعيار HL7 FHIR. يُجلب الملف الحرج فقط، لا الملف الكامل.
        </p>
      </div>
    </Screen>
  )

  function ProfileCard() {
    return (
      <Card>
        <h2 className="mb-1 text-[13px] font-semibold text-secondary">الملف الحرج</h2>
        <Row
          label="الحساسيات"
          value={
            patient!.allergies.length ? (
              <span className="text-critical-fg">
                {patient!.allergies.map((a) => `${familyLabel(a.family)} — ${a.reaction}`).join('، ')}
              </span>
            ) : (
              'لا توجد حساسية مسجلة'
            )
          }
        />
        <Row label="الأدوية الحالية" value={meds.length ? meds.join('، ') : 'لا يوجد'} />
        <Row
          label="أمراض مزمنة"
          value={patient!.conditions.length ? patient!.conditions.map((c) => CONDITION_AR[c] ?? c).join('، ') : 'لا يوجد'}
        />
        <Row
          label="آخر eGFR"
          value={
            patient!.egfr ? (
              `${patient!.egfr.value} مل/د — ${patient!.egfr.measuredAt}`
            ) : (
              <span className="text-warning-fg">⚠️ قراءة الكلى مفقودة</span>
            )
          }
        />
        <Row label="فصيلة الدم" value={patient!.bloodType ?? '—'} />
      </Card>
    )
  }
}
