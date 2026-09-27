import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Button, Card, Row, Screen } from '../components/ui'
import { CONDITION_AR, findDrugById, findPilgrim, pilgrimToPatient } from '../data'
import { familyLabel } from '../engine/checks'
import { useSession } from '../lib/session'

/** What was read from the Hajj card, confirmed by the nurse before any drug is scanned. */
export default function HajjCard() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: { pilgrimId?: string } | null }
  const { setPatient } = useSession()
  const pilgrim = state?.pilgrimId ? findPilgrim(state.pilgrimId) : undefined

  if (!pilgrim) return <Navigate to="/scan/hajj" replace />

  const meds = pilgrim.currentMeds.map((id) => findDrugById(id)?.nameAr ?? id)
  const ckd = pilgrim.conditions.includes('ckd')

  const confirm = () => {
    setPatient(pilgrimToPatient(pilgrim))
    navigate('/scan/drug')
  }

  return (
    <Screen
      title="بطاقة الحاج"
      back="/scan/hajj"
      footer={
        <>
          <Button icon="pill" onClick={confirm}>
            تأكيد الهوية ومسح الدواء
          </Button>
          <Button variant="secondary" onClick={() => navigate('/scan/hajj')}>
            ليس هذا المريض
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Identity, laid out like the physical card so the nurse can compare */}
        <section className="overflow-hidden rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between bg-brand px-4 py-2.5 text-brand-on">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
              <Icon name="idCard" size={18} />
              بطاقة الحاج — موسم 1447هـ
            </span>
            <span dir="ltr" className="font-mono text-[12px] opacity-90">
              {pilgrim.pilgrimId}
            </span>
          </div>
          <div className="p-4">
            <p className="text-lg font-semibold">{pilgrim.name}</p>
            <p dir="ltr" className="text-end text-[13px] text-secondary">
              {pilgrim.nameLatin}
            </p>
            <div className="mt-2 border-t border-line pt-1.5">
              <Row label="الجنسية" value={pilgrim.nationality} />
              <Row label="العمر" value={`${pilgrim.age} سنة`} />
              <Row label="الحملة" value={pilgrim.campaign} />
              {pilgrim.emergencyContact && <Row label="للتواصل" value={pilgrim.emergencyContact} />}
            </div>
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-md bg-brand-subtle p-3 text-[13px] leading-6 text-brand">
          <Icon name="globe" size={18} className="mt-0.5 shrink-0" />
          لغة الحاج: {pilgrim.language}. تأكدي من الهوية بمقارنة الصورة في البطاقة، واستعيني بمترجم أو مرشد الحملة عند الحاجة.
        </p>

        {/* Declared health data */}
        <Card>
          <h2 className="mb-1 text-[13px] font-semibold text-secondary">المعلومات الصحية في البطاقة</h2>
          <Row
            label="الحساسيات"
            value={
              pilgrim.allergies.length ? (
                <span className="text-critical-fg">
                  {pilgrim.allergies.map((a) => `${familyLabel(a.family)} — ${a.reaction}`).join('، ')}
                </span>
              ) : (
                'لم يصرّح بحساسية'
              )
            }
          />
          <Row
            label="أمراض مزمنة"
            value={pilgrim.conditions.length ? pilgrim.conditions.map((c) => CONDITION_AR[c] ?? c).join('، ') : 'لا يوجد'}
          />
          <Row label="أدوية يستخدمها" value={meds.length ? meds.join('، ') : 'لا يوجد'} />
          <Row label="فصيلة الدم" value={pilgrim.bloodType ?? '—'} />
          <Row
            label="آخر eGFR"
            value={<span className={ckd ? 'text-renal-fg' : ''}>غير متوفر — لا يوجد تحليل في المستشفى</span>}
          />
        </Card>

        <Card className="py-3">
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-secondary">
            <Icon name="shield" size={14} />
            كيف يتعامل MEDGUARD مع بيانات البطاقة
          </h2>
          <ul className="flex flex-col gap-1.5 text-[13px] leading-6 text-secondary">
            <li>• الحساسية المصرّح بها تمنع الإعطاء مثل الحساسية الموثقة، حتى يراجعها الطبيب.</li>
            <li>• أدويته الحالية تدخل في فحص التعارضات.</li>
            <li>
              • لا يوجد تحليل كلى، فالأدوية التي تعتمد جرعتها على الكلى{' '}
              {ckd || pilgrim.age >= 65 ? 'ستظهر بالأصفر مع طلب تحليل عاجل.' : 'تظهر كملاحظة مؤجلة.'}
            </li>
          </ul>
        </Card>
      </div>
    </Screen>
  )
}
