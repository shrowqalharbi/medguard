import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { AiBadge, BottomSheet, Button, Card, Row, Screen } from '../components/ui'
import type { Decision, Finding, Level } from '../engine'
import { recordEvent, type Outcome } from '../lib/events'
import { useSession } from '../lib/session'
import { playCritical } from '../lib/sound'

const LOOK: Record<Level, { box: string; fg: string; solid: string; icon: IconName; label: string }> = {
  safe: { box: 'bg-safe-bg border-safe-border', fg: 'text-safe-fg', solid: 'bg-safe-solid', icon: 'check', label: 'آمن للإعطاء' },
  renal: { box: 'bg-renal-bg border-renal-border', fg: 'text-renal-fg', solid: 'bg-renal-solid', icon: 'droplet', label: 'يتطلب تعديل الجرعة' },
  interaction: {
    box: 'bg-interaction-bg border-interaction-border',
    fg: 'text-interaction-fg',
    solid: 'bg-interaction-solid',
    icon: 'alert',
    label: 'تعارض دوائي',
  },
  critical: { box: 'bg-critical-bg border-critical-border', fg: 'text-critical-fg', solid: 'bg-critical-solid', icon: 'stop', label: 'ممنوع الإعطاء' },
}

const DOT: Record<Finding['severity'], string> = {
  critical: 'bg-critical-solid',
  interaction: 'bg-interaction-solid',
  renal: 'bg-renal-solid',
  info: 'bg-tertiary',
}

const OVERRIDE_REASONS = ['الطبيب على علم ووافق', 'يأخذه سابقاً دون مشاكل', 'جرعة لمرة واحدة', 'تمت مراقبة INR اليوم']

/** One line per check, so the nurse sees all three were actually run. */
function summary(d: Decision) {
  const has = (...kinds: Finding['kind'][]) => d.all.find((f) => kinds.includes(f.kind))
  const allergy = has('allergy', 'allergy-from-note')
  const interaction = d.all.find((f) => f.kind === 'interaction')
  const renal = has('renal-contraindicated', 'renal-adjust', 'renal-avoid', 'renal-near-threshold', 'renal-unknown')
  return [
    {
      label: 'الحساسية الدوائية',
      value: allergy
        ? allergy.source === 'ai'
          ? 'محتملة (من ملاحظة)'
          : allergy.title.includes('بطاقة الحاج')
            ? 'مصرّح بها في بطاقة الحاج'
            : 'موثقة'
        : 'لا يوجد ✓',
    },
    { label: 'التعارض مع أدويته الحالية', value: interaction ? (interaction.severity === 'info' ? 'بسيط' : 'مهم') : 'لا يوجد ✓' },
    { label: 'الجرعة مقابل الكلى', value: renal ? renal.title : 'مناسبة ✓' },
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
  const needsLab = p?.kind === 'renal-unknown'
  const look = needsLab ? { ...LOOK.renal, icon: 'droplet' as const, label: 'يحتاج تحليل كلى' } : LOOK[decision.level]
  const aiPrimary = p?.source === 'ai'

  const finish = (outcome: Outcome, text: string) => {
    recordEvent({
      nurse: nurse ?? 'ممرض',
      device: 'MG-014',
      patientId: patient.id,
      patientName: patient.name,
      room: patient.room,
      drugId: drug.id,
      drugName: `${drug.nameAr} ${drug.strength}`,
      level: decision.level,
      title: p?.title ?? 'فحص آمن',
      deferredCount: decision.deferred.length,
      aiDetected: aiPrimary,
      outcome,
      overrideReason: outcome === 'given-with-reason' ? (reason ?? undefined) : undefined,
      overrideKind: outcome === 'given-with-reason' ? p?.kind : undefined,
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
              مسح دواء آخر لنفس المريض
            </Button>
            <Button variant="secondary" onClick={() => (setPatient(null), navigate('/scan/patient'))}>
              مريض جديد
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
            {drug.nameAr} — {patient.name}، {patient.hajj ? 'مريض حاج بالطوارئ' : `غرفة ${patient.room}`}. سُجّل في ملف المريض وظهر في لوحة المشرفة.
          </p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen
      title="نتيجة الفحص"
      back="/scan/drug"
      onBack={() => (clearDrug(), navigate('/scan/drug'))}
      footer={actions()}
    >
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

        {/* What was scanned */}
        <Card className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">
                {drug.nameAr} {drug.strength}
              </p>
              <p className="text-[12px] text-tertiary">
                {patient.name} · {patient.hajj ? `بطاقة حاج ${patient.hajj.pilgrimId}` : `غرفة ${patient.room}`}
              </p>
            </div>
            <Icon name="pill" size={20} className="text-tertiary" />
          </div>
          <div className="mt-2 border-t border-line pt-1.5">
            {summary(decision).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </Card>

        {/* Why */}
        {p && (
          <Card>
            <h3 className="mb-1 text-[13px] font-semibold text-secondary">السبب</h3>
            <p className="text-[15px] leading-7">
              {decision.level === 'renal' && decision.adjustedDose
                ? `وظائف الكلى الحالية تستدعي تخفيض الجرعة. آخر eGFR: ${patient.egfr?.value} مل/د (${patient.egfr?.measuredAt}).`
                : p.detail}
            </p>
            {decision.level === 'renal' && decision.adjustedDose && (
              <div className="mt-3 border-t border-line pt-2">
                <Row label="الجرعة الموصوفة" value={<s className="text-tertiary">{drug.standardDose}</s>} />
                <Row label="الجرعة المعدّلة آلياً" value={<span className="text-renal-fg">{decision.adjustedDose}</span>} />
              </div>
            )}
          </Card>
        )}

        {/* AI evidence */}
        {aiPrimary && p?.evidence && (
          <Card className="border-critical-border">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-secondary">مصدر الاكتشاف</h3>
              <AiBadge label={p.detectedBy === 'llm' ? 'اكتشاف الذكاء' : 'اكتشاف الذكاء (دون اتصال)'} />
            </div>
            <blockquote className="rounded-md bg-surface-2 p-3 text-[13px] leading-6">«{p.evidence}»</blockquote>
            <p className="mt-2 text-[12px] leading-5 text-tertiary">
              خانة الحساسية فارغة، فالقواعد وحدها كانت ستسمح بالإعطاء. الذكاء يرفع الخطر فقط ولا يخفّضه، والطبيب يؤكد ويسجل الحساسية.
            </p>
          </Card>
        )}

        {decision.level === 'critical' && (
          <p className="flex items-center gap-2 rounded-md bg-critical-bg p-3 text-[13px] text-critical-fg">
            <Icon name="stop" size={16} className="shrink-0" />
            أُوقف الإجراء تلقائياً. لا يمكن تجاوز هذا التنبيه من جهاز الممرض.
          </p>
        )}

        {/* Override reason (orange only) */}
        {decision.level === 'interaction' && (
          <Card ref={reasonRef} className={reasonError ? 'border-critical-solid' : ''}>
            <h3 className="text-[13px] font-semibold text-secondary">سبب المتابعة (مطلوب — يتعلّم منه النظام)</h3>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="سبب المتابعة">
              {OVERRIDE_REASONS.map((r) => (
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
      case 'renal':
        if (needsLab)
          return (
            <>
              <Button tone="renal" icon="bell" onClick={() => finish('escalated', 'طُلب تحليل كلى وأُبلغ الطبيب')}>
                طلب تحليل كلى عاجل وإبلاغ الطبيب
              </Button>
              <Button variant="secondary" onClick={() => finish('given', 'أُعطي بموافقة الطبيب')}>
                إعطاء الجرعة المعتادة بموافقة الطبيب
              </Button>
            </>
          )
        return (
          <>
            <Button tone="renal" onClick={() => finish('given-adjusted', 'أُعطيت الجرعة المعدّلة')}>
              إعطاء الجرعة المعدّلة
            </Button>
            <Button variant="secondary" onClick={() => finish('escalated', 'أُرسل للطبيب المناوب')}>
              مراجعة مع الطبيب المناوب
            </Button>
          </>
        )
      case 'interaction':
        return (
          <>
            <Button
              tone="interaction"
              onClick={() => {
                if (reason) return finish('given-with-reason', 'تم الإعطاء مع توثيق السبب')
                setReasonError(true)
                reasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              تأكيد المتابعة مع السبب
            </Button>
            <Button variant="secondary" onClick={() => finish('escalated', 'أُلغي وأُبلغ الطبيب')}>
              إلغاء وإبلاغ الطبيب
            </Button>
          </>
        )
      case 'critical':
        return (
          <>
            <Button tone="critical" icon="bell" onClick={() => finish('escalated', 'تم إبلاغ الطبيب')}>
              {aiPrimary ? 'إبلاغ الطبيب لتأكيد الحساسية' : 'إبلاغ الطبيب فوراً'}
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
  return (
    <Card className="py-3">
      <div className="flex items-center justify-between">
        <AiBadge />
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
    </Card>
  )
}

const SEVERITY_TEXT: Record<Finding['severity'], string> = {
  critical: 'حرج',
  interaction: 'متوسط — تعارض',
  renal: 'متوسط — كلوي',
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
        {f.noiseScore !== undefined && (
          <p className="mt-2 text-tertiary">
            سبب التأجيل: النموذج يقدّر أن {Math.round(f.noiseScore * 100)}٪ من الممرضين يعتبرون هذه الملاحظة غير مهمة في هذا الموقف.
          </p>
        )}
      </div>
      <Button variant="secondary" onClick={onClose}>
        تم الاطلاع
      </Button>
    </div>
  )
}
