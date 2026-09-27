import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Scanner } from '../components/Scanner'
import { BottomSheet, Button, Screen } from '../components/ui'
import { patients } from '../data'
import { getDemo } from '../lib/prefs'
import { resolveScan } from '../lib/resolve'
import { useSession } from '../lib/session'
import { unlockAudio } from '../lib/sound'

export default function ScanPatient() {
  const navigate = useNavigate()
  const { setPatient } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  const handle = (text: string): boolean => {
    const r = resolveScan(text)
    if (r.kind === 'patient') {
      setPatient(r.patient)
      navigate('/scan/drug')
      return true
    }
    if (r.kind === 'drug') {
      setError('هذا باركود دواء. امسحي سوار المريض أولاً حتى نعرف لمن الجرعة.')
    } else {
      setError(`لا يوجد مريض منوّم بهذا السوار (${r.value}). تأكدي من السوار أو أدخلي الرقم يدوياً.`)
    }
    setAttempt((n) => n + 1) // restart the camera
    return false
  }

  const submitManual = () => {
    if (!code.trim()) return setCodeError('اكتبي رقم السوار أولاً، مثل A-2291')
    const r = resolveScan(code)
    if (r.kind !== 'patient') return setCodeError(`لا يوجد مريض بالرقم ${code.trim()}.`)
    setManual(false)
    handle(code)
  }

  return (
    <Screen
      dark
      title="مسح سوار المريض"
      back="/home"
      footer={
        <>
          {getDemo() && (
            <div className="flex gap-2">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => (unlockAudio(), handle(p.wristband))}
                  className="flex-1 rounded-md border border-white/15 py-2 text-[12px] text-white/70"
                >
                  محاكاة: {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
          <Button variant="secondary" icon="keyboard" onClick={() => (unlockAudio(), setManual(true))}>
            إدخال رقم السوار يدوياً
          </Button>
        </>
      }
    >
      <div className="flex flex-1 flex-col items-center gap-4 pt-2">
        <Scanner key={attempt} onResult={handle} aspect="square" label="جارٍ البحث عن السوار…" />
        <div className="text-center">
          <p className="text-[15px] font-medium">وجّهي الكاميرا نحو باركود سوار المريض</p>
          <p className="mt-1 text-[13px] text-white/55">يُقرأ السوار تلقائياً دون الضغط على أي زر</p>
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
          <label htmlFor="wb" className="text-base font-semibold">
            رقم سوار المريض
          </label>
          <input
            id="wb"
            autoFocus
            dir="ltr"
            value={code}
            onChange={(e) => (setCode(e.target.value), setCodeError(null))}
            placeholder="A-2291"
            aria-invalid={!!codeError}
            aria-describedby="wb-err"
            className={`h-12 rounded-md border bg-surface px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand/40 ${
              codeError ? 'border-critical-solid' : 'border-line'
            }`}
          />
          {codeError && (
            <p id="wb-err" className="text-[13px] text-critical-fg">
              {codeError}
            </p>
          )}
          <Button type="submit">متابعة</Button>
        </form>
      </BottomSheet>
    </Screen>
  )
}
