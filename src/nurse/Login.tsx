import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'
import { useSession } from '../lib/session'
import { unlockAudio } from '../lib/sound'

/** Demo staff directory. Real deployments use the hospital's identity provider. */
const STAFF: Record<string, string> = { 'N-48213': 'سارة العنزي', 'N-51007': 'منى القحطاني' }

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<{ id?: string; pin?: string }>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    unlockAudio()
    const next: typeof errors = {}
    if (!id.trim()) next.id = 'اكتبي رقمك الوظيفي، مثل N-48213'
    if (pin.length < 4) next.pin = 'رمز الدخول 4 أرقام على الأقل'
    setErrors(next)
    if (Object.keys(next).length) return
    const key = id.trim().toUpperCase()
    signIn(STAFF[key] ?? key)
    navigate('/home')
  }

  const field = (err?: string) =>
    `h-12 w-full rounded-md border bg-surface px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand/40 ${
      err ? 'border-critical-solid' : 'border-line'
    }`

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="mb-10 flex justify-center">
          <Logo variant="full-en" size={88} />
        </h1>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="id" className="text-[13px] text-secondary">
              الرقم الوظيفي
            </label>
            <input
              id="id"
              dir="ltr"
              autoComplete="username"
              value={id}
              onChange={(e) => (setId(e.target.value), setErrors((x) => ({ ...x, id: undefined })))}
              placeholder="N-48213"
              aria-invalid={!!errors.id}
              className={field(errors.id)}
            />
            {errors.id && <p className="text-[13px] text-critical-fg">{errors.id}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pin" className="text-[13px] text-secondary">
              رمز الدخول
            </label>
            <input
              id="pin"
              dir="ltr"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => (setPin(e.target.value), setErrors((x) => ({ ...x, pin: undefined })))}
              placeholder="••••"
              aria-invalid={!!errors.pin}
              className={field(errors.pin)}
            />
            {errors.pin && <p className="text-[13px] text-critical-fg">{errors.pin}</p>}
          </div>
          <Button type="submit" className="mt-2">
            تسجيل الدخول
          </Button>
        </form>
      </div>
      <p className="pb-8 text-center text-[12px] text-tertiary" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        مستشفى الملك عبدالله التخصصي — قسم الباطنة
      </p>
    </div>
  )
}
