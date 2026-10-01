import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { AiBadge, BottomSheet, Button, Card, Row, Screen } from '../components/ui'
import type { Decision, Finding, FindingKind, Level } from '../engine'
import { recordEvent, type Outcome } from '../lib/events'
import { useSession } from '../lib/session'
import { playCritical } from '../lib/sound'

const LOOK: Record<Level, { box: string; fg: string; solid: string; icon: IconName; label: string }> = {
  safe: { box: 'bg-safe-bg border-safe-border', fg: 'text-safe-fg', solid: 'bg-safe-solid', icon: 'check', label: 'آمن للإعطاء' },
  warning: { box: 'bg-warning-bg border-warning-border', fg: 'text-warning-fg', solid: 'bg-warning-solid', icon: 'alert', label: 'خطر مرتفع' },
  critical: { box: 'bg-critical-bg border-critical-border', fg: 'text-critical-fg', solid: 'bg-critical-solid', icon: 'stop', label: 'ممنوع الإعطاء' },
}

/** Orange covers drug interactions and every kidney alert (the old yellow). */
const WARNING_LABEL: Partial<Record<FindingKind, { label: string; icon: IconName }>> = {
  interaction: { label: 'تعارض دوائي', icon: 'alert' },
  'renal-adjust': { label: 'يتطلب تعديل الجرعة', icon: 'droplet' },
  'renal-avoid': { label: 'يُفضّل تجنبه — الكلى', icon: 'droplet' },
  'renal-unknown': { label: 'يحتاج قراءة كلى', icon: 'droplet' },
}

const DOT: Record<Finding['severity'], string> = {
  critical: 'bg-critical-solid',
  warning: 'bg-warning-solid',
  info: 'bg-tertiary',
}

const ADJUSTED = 'إعطاء الجرعة المعدّلة المقترحة'

/** Reasons a nurse can give to continue past an orange alert. Recorded in the audit trail. */
const REASONS: Partial<Record<FindingKind, string[]>> = {
  interaction: ['الطبيب على علم ووافق', 'يأخذه سابقاً دون مشاكل', 'جرعة لمرة واحدة', 'تمت مراقبة INR اليوم'],
  'renal-adjust': [ADJUSTED, 'الطبيب حدّد الجرعة', 'جرعة لمرة واحدة'],
  'renal-avoid': ['الطبيب على علم ووافق', 'لا يوجد بديل مناسب', 'جرعة لمرة واحدة'],
  'renal-unknown': ['الطبيب وافق قبل نتيجة التحليل', 'جرعة لمرة واحدة'],
}

/** One line per check, so the nurse sees all three were actually run. */
function summary(d: Decision, source: 'ehr' | 'kkjh') {
  const allergy = d.all.find((f) => f.kind === 'allergy')
  const interaction = d.all.find((f) => f.kind === 'interaction')
  const renal = d.all.find((f) => f.kind.startsWith('renal-'))
  return [
    {
      label: 'الحساسية الدوائية',
      value: allergy ? (source === 'kkjh' ? 'مسجلة في بطاقة KKJH' : 'مسجلة في السجل الصحي') : 'لا يوجد ✓',
    },
    { label: 'التعارض مع أدويته الحالية', value: interaction ? (interaction.severity === 'info' ? 'بسيط' : 'مهم') : 'لا يوجد ✓' },
    {
      label: 'الجرعة مقابل الكلى',
      value: renal ? renal.title : d.renalMissing ? 'قراءة الكلى مفقودة' : 'مناسبة ✓',
    },
  ]
}

export default function Result() {
  const navigate = useNavigate()
  const { patient, drug, decision, nurse, clearDrug, setPatient } = useSession()
  const [reason, setReason] = useState<string | null>(null)
  const [reasonError, setReasonError] = useState(false)
  const [open, setOpen] = useState<Finding | null>(null)
  const [done, setDone] = useState<{ outcome: Outcome; text: string } | null>(null)
  const sounded = useRef(false)
  const reasonRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (decision?.level === 'critical' && !sounded.current) {
      sounded.current = true
      playCritical()
    }
  }, [decision])

  if (!patient || !drug || !decision) return <Navigate to="/scan/drug" replace />

  const p = decision.primary
  const warn = decision.level === 'warning' && p ? WARNING_LABEL[p.kind] : undefined
  const look = warn ? { ...LOOK.warning, ...warn } : LOOK[decision.level]
  const reasons = (p && REASONS[p.kind]) ?? REASONS.interaction!
  const showDose = p?.kind === 'renal-adjust' && decision.adjustedDose

  const finish = (outcome: Outcome, text: string) => {
    recordEvent({
      nurse: nurse ?? 'ممرض',
      device: 'MG-014',
      patientId: patient.id,
      patientName: patient.name,
      room: patient.bed,
      drugId: drug.id,
      drugName: `${drug.nameAr} ${drug.strength}`,
      level: decision.level,
      title: p?.title ?? 'فحص آمن',
      deferredCount: decision.deferred.length,
      rankedBy: decision.rankedBy,
      outcome,
      overrideReason: outcome.startsWith('given-') ? (reason ?? undefined) : undefined,
      overrideKind: outcome.startsWith('given-') ? p?.kind : undefined,
    })
    setDone({ outcome, text })
  }

  if (done) {
    const positive = done.outcome.startsWith('given')
    return (
      <Screen
        footer={
          <>
            <Button onClick={() => (clearDrug(), navigate('/scan/drug'))} icon="pill">
              مسح دواء آخر لنفس الحاج
            </Button>
            <Button variant="secondary" onClick={() => (setPatient(null), navigate('/scan/patient'))}>
              حاج جديد
            </Button>
          </>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" role="status">
          <span className={`grid h-16 w-16 place-items-center rounded-full ${positive ? 'bg-safe-solid' : 'bg-surface-2'} text-white`}>
            <Icon name={positive ? 'check' : 'file'} size={32} className={positive ? '' : 'text-secondary'} />
          </span>
          <h1 className="text-[22px] font-bold">{done.text}</h1>
          <p className="max-w-[300px] text-[13px] leading-6 text-secondary">
            {drug.nameAr} — {patient.name}، {patient.unit} · {patient.bed}. سُجّل في سجل التدقيق.
          </p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="نتيجة الفحص" back="/scan/drug" onBack={() => (clearDrug(), navigate('/scan/drug'))} footer={actions()}>
      <div className="flex flex-col gap-3">
        {/* Decision */}
        <section
          className={`flex flex-col items-center gap-2 rounded-lg border-[1.5px] px-5 py-5 text-center ${look.box}`}
          aria-live="assertive"
        >
          <span className={`grid h-16 w-16 place-items-center rounded-full text-white ${look.solid}`}>
            <Icon name={look.icon} size={32} />
          </span>
          <h2 className={`text-[22px] font-bold ${look.fg}`}>{look.label}</h2>
          <p className={`text-[15px] leading-7 ${look.fg}`}>{p ? p.title : 'لا توجد حساسيات أو تعارضات تستدعي مقاطعتك'}</p>
        </section>

        {decision.renalMissing && (
          <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-[13px] leading-6 text-warning-fg">
            <Icon name="droplet" size={16} className="mt-1 shrink-0" />
            ⚠️ أظهرنا التعارضات المتاحة، قراءة الكلى مفقودة.
          </p>
        )}

        {/* What was scanned */}
        <Card className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">
                {drug.nameAr} {drug.strength}
              </p>
              <p className="text-[12px] text-tertiary">
                {patient.name} · {patient.source === 'kkjh' ? 'KKJH' : 'هوية'} {patient.recordNo}
              </p>
            </div>
            <Icon name="pill" size={20} className="text-tertiary" />
          </div>
          <div className="mt-2 border-t border-line pt-1.5">
            {summary(decision, patient.source).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </Card>

        {/* Why */}
        {p && (
          <Card>
            <h3 className="mb-1 text-[13px] font-semibold text-secondary">السبب</h3>
            <p className="text-[15px] leading-7">{p.detail}</p>
            {showDose && (
              <div className="mt-3 border-t border-line pt-2">
                <Row label="الجرعة الموصوفة" value={<s className="text-tertiary">{drug.standardDose}</s>} />
                <Row label="الجرعة المقترحة" value={<span className="text-warning-fg">{decision.adjustedDose}</span>} />
              </div>
            )}
          </Card>
        )}

        {decision.level === 'critical' && (
          <p className="flex items-start gap-2 rounded-md bg-critical-bg p-3 text-[13px] leading-6 text-critical-fg">
            <Icon name="stop" size={16} className="mt-1 shrink-0" />
            أُوقف الإعطاء نهائياً، ولا يوجد تجاوز. الحل الوحيد أن يغيّر الطبيب الدواء، ثم تُمسح الوصفة الجديدة.
          </p>
        )}

        {/* Reason to continue (orange only) */}
        {decision.level === 'warning' && (
          <Card ref={reasonRef} className={reasonError ? 'border-critical-solid' : ''}>
            <h3 className="text-[13px] font-semibold text-secondary">سبب المتابعة (مطلوب — يُسجَّل في سجل التدقيق)</h3>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="سبب المتابعة">
              {reasons.map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => (setReason(r), setReasonError(false))}
                  className={`rounded-full border px-3 py-1.5 text-[13px] ${
                    reason === r ? 'border-brand bg-brand-subtle text-brand' : 'border-line bg-surface-2 text-secondary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reasonError && <p className="mt-2 text-[13px] text-critical-fg">اختاري سبباً قبل المتابعة.</p>}
          </Card>
        )}

        {/* Triage: everything that did not interrupt */}
        <Deferred decision={decision} onOpen={setOpen} />
      </div>

      <BottomSheet open={!!open} onClose={() => setOpen(null)}>
        {open && <FindingDetail f={open} onClose={() => setOpen(null)} />}
      </BottomSheet>
    </Screen>
  )

  function actions() {
    switch (decision!.level) {
      case 'safe':
        return (
          <>
            <Button tone="safe" icon="check" onClick={() => finish('given', 'تم تسجيل الإعطاء')}>
              تأكيد وإعطاء الجرعة
            </Button>
            <Button variant="secondary" onClick={() => finish('cancelled', 'أُلغي الإعطاء')}>
              إلغاء
            </Button>
          </>
        )
      case 'warning':
        return (
          <>
            <Button
              tone="warning"
              onClick={() => {
                if (!reason) {
                  setReasonError(true)
                  reasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  return
                }
                if (reason === ADJUSTED) return finish('given-adjusted', 'أُعطيت الجرعة المعدّلة')
                finish('given-with-reason', 'تم الإعطاء مع توثيق السبب')
              }}
            >
              تأكيد المتابعة مع السبب
            </Button>
            <Button variant="secondary" onClick={() => finish('escalated', p?.kind === 'renal-unknown' ? 'طُلب تحليل كلى وأُبلغ الطبيب' : 'أُلغي وأُبلغ الطبيب')}>
              {p?.kind === 'renal-unknown' ? 'طلب تحليل كلى وإبلاغ الطبيب' : 'إلغاء وإبلاغ الطبيب'}
            </Button>
          </>
        )
      case 'critical':
        return (
          <>
            <Button tone="critical" icon="bell" onClick={() => finish('escalated', 'أُبلغ الطبيب لتغيير الدواء')}>
              إبلاغ الطبيب لتغيير الدواء
            </Button>
            <Button variant="secondary" onClick={() => finish('blocked', 'أُوقف الإعطاء')}>
              إيقاف والعودة
            </Button>
          </>
        )
    }
  }
}

function Deferred({ decision, onOpen }: { decision: Decision; onOpen: (f: Finding) => void }) {
  const n = decision.deferred.length
  const claude = decision.rankedBy === 'claude'
  return (
    <Card className="py-3">
      <div className="flex items-center justify-between">
        {claude ? (
          <AiBadge label="فرز Claude للتنبيهات" />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-medium text-secondary">
            <Icon name="shield" size={12} />
            ترتيب احتياطي ثابت
          </span>
        )}
        <span className="text-[12px] text-tertiary">{n > 0 ? `أُجّلت ${n}` : `فُحص ${decision.all.length || 3} عناصر`}</span>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-secondary">{decision.explanation}</p>
      {n > 0 && (
        <ul className="-mx-2 mt-1">
          {decision.deferred.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => onOpen(f)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start text-[13px] text-tertiary active:bg-surface-2"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[f.severity]}`} />
                <span className="flex-1">{f.title}</span>
                <Icon name="chevronLeft" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 border-t border-line pt-2 text-[11px] leading-5 text-tertiary">
        {claude
          ? 'رتّب Claude التنبيهات غير الحرجة فقط. اللون تحدده القواعد الطبية، والأحمر لا يمر على Claude أبداً.'
          : 'بدون اتصال أو عند تأخر الرد: ترتيب ثابت حسب الخطورة. قرار السلامة لا يتأثر.'}
      </p>
    </Card>
  )
}

const SEVERITY_TEXT: Record<Finding['severity'], string> = {
  critical: 'حرج',
  warning: 'مرتفع',
  info: 'للعلم فقط',
}

function FindingDetail({ f, onClose }: { f: Finding; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[f.severity]}`} />
        <div>
          <h2 className="text-base font-semibold">{f.title}</h2>
          <p className="text-[12px] text-tertiary">أولوية {SEVERITY_TEXT[f.severity]} — أقل من التنبيه المعروض</p>
        </div>
      </div>
      <div className="rounded-md bg-surface-2 p-4 text-[13px] leading-6">
        <p>{f.detail}</p>
        {f.rankReason && <p className="mt-2 text-tertiary">سبب الترتيب (Claude): {f.rankReason}</p>}
      </div>
      <Button variant="secondary" onClick={onClose}>
        تم الاطلاع
      </Button>
    </div>
  )
}
