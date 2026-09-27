import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Scanner } from '../components/Scanner'
import { BottomSheet, Button, Screen } from '../components/ui'
import { pilgrims } from '../data'
import { getDemo } from '../lib/prefs'
import { resolveScan } from '../lib/resolve'
import { useSession } from '../lib/session'
import { unlockAudio } from '../lib/sound'

/**
 * Pilgrim with no hospital wristband (typically brought to the ER during Hajj):
 * the nurse scans the QR on their Hajj card instead. The card links to what the
 * pilgrim declared at registration: allergies, chronic conditions, medicines.
 */
export default function ScanHajj() {
  const navigate = useNavigate()
  const { setPatient } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  const handle = (text: string) => {
    const r = resolveScan(text)
    if (r.kind === 'pilgrim' && r.pilgrim) return navigate('/hajj', { state: { pilgrimId: r.pilgrimId } })
    if (r.kind === 'patient') {
      // Already admitted: the hospital record is more complete than the card.
      setPatient(r.patient)
      return navigate('/scan/drug')
    }
    setError(
      r.kind === 'pilgrim'
        ? `بطاقة الحاج ${r.pilgrimId} غير موجودة في السجل الصحي للحج. أدخلي الرقم يدوياً للتأكد، أو عامليه كمريض جديد دون بيانات.`
        : r.kind === 'drug'
          ? 'هذا باركود دواء. امسحي رمز QR الموجود على بطاقة الحاج أولاً.'
          : 'هذا الرمز ليس بطاقة حاج. ابحثي عن رمز QR على البطاقة، أو أدخلي رقم الحاج يدوياً.',
    )
    setAttempt((n) => n + 1)
  }

  const submitManual = () => {
    if (!code.trim()) return setCodeError('اكتبي رقم الحاج كما في البطاقة، مثل H-1447-208153')
    const r = resolveScan(code)
    if (r.kind !== 'pilgrim') return setCodeError('صيغة الرقم غير صحيحة. رقم الحاج يبدأ بـ H ثم السنة ثم 6 أرقام.')
    if (!r.pilgrim) return setCodeError(`لا يوجد حاج بالرقم ${r.pilgrimId} في السجل الصحي.`)
    setManual(false)
    handle(code)
  }

  return (
    <Screen
      dark
      title="مسح بطاقة الحاج"
      back="/home"
      footer={
        <>
          {getDemo() && (
            <div className="flex gap-2">
              {pilgrims.map((p) => (
                <button
                  key={p.pilgrimId}
                  onClick={() => (unlockAudio(), handle(`HAJJ:${p.pilgrimId}`))}
                  className="flex-1 rounded-md border border-white/15 py-2 text-[12px] text-white/70"
                >
                  محاكاة: {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
          <Button variant="secondary" icon="keyboard" onClick={() => (unlockAudio(), setManual(true))}>
            إدخال رقم الحاج يدوياً
          </Button>
        </>
      }
    >
      <div className="flex flex-1 flex-col items-center gap-4 pt-2">
        <Scanner key={attempt} onResult={handle} aspect="square" label="جارٍ البحث عن رمز البطاقة…" />
        <div className="text-center">
          <p className="text-[15px] font-medium">وجّهي الكاميرا نحو رمز QR في بطاقة الحاج</p>
          <p className="mt-1 text-[13px] leading-6 text-white/55">
            للحاج الذي لم يُسجَّل له سوار بعد. نقرأ حساسياته وأدويته المصرّح بها في البطاقة.
          </p>
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-critical-solid/15 p-3 text-[13px] leading-6 text-[#FF8A8A]">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <BottomSheet open={manual} onClose={() => setManual(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitManual()
          }}
          className="flex flex-col gap-3 text-primary"
        >
          <label htmlFor="pid" className="text-base font-semibold">
            رقم الحاج
          </label>
          <input
            id="pid"
            autoFocus
            dir="ltr"
            value={code}
            onChange={(e) => (setCode(e.target.value), setCodeError(null))}
            placeholder="H-1447-208153"
            aria-invalid={!!codeError}
            aria-describedby="pid-err"
            className={`h-12 rounded-md border bg-surface px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand/40 ${
              codeError ? 'border-critical-solid' : 'border-line'
            }`}
          />
          {codeError && (
            <p id="pid-err" className="text-[13px] text-critical-fg">
              {codeError}
            </p>
          )}
          <Button type="submit">متابعة</Button>
        </form>
      </BottomSheet>
    </Screen>
  )
}
