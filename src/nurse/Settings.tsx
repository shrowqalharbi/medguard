import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Screen } from '../components/ui'
import { applyTheme, getDemo, getSound, getTheme, setDemo, setSound, type ThemePref } from '../lib/prefs'
import { useSession } from '../lib/session'

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px]">{label}</span>
        <span className="block text-[12px] text-tertiary">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 after:absolute after:top-1 after:start-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:-translate-x-5" />
    </label>
  )
}

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'النظام' },
  { id: 'light', label: 'فاتح' },
  { id: 'dark', label: 'داكن' },
]

export default function Settings() {
  const navigate = useNavigate()
  const { nurse, signOut } = useSession()
  const [theme, setTheme] = useState(getTheme())
  const [sound, setSoundState] = useState(getSound())
  const [demo, setDemoState] = useState(getDemo())

  return (
    <Screen title="الإعدادات" back="/home">
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-3 text-[13px] font-semibold text-secondary">المظهر</h2>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-surface-2 p-1" role="radiogroup" aria-label="المظهر">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => (applyTheme(t.id), setTheme(t.id))}
                className={`h-10 rounded-sm text-[13px] font-medium ${theme === t.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="py-1">
          <Toggle
            label="صوت التنبيه الحرج"
            hint="الأخضر صامت دائماً، والصوت للأحمر فقط"
            on={sound}
            onChange={(v) => (setSound(v), setSoundState(v))}
          />
          <div className="border-t border-line" />
          <Toggle
            label="وضع العرض التجريبي"
            hint="أزرار محاكاة المسح، احتياطاً إذا تعذّرت الكاميرا"
            on={demo}
            onChange={(v) => (setDemo(v), setDemoState(v))}
          />
        </Card>

        <Card>
          <p className="text-[13px] text-secondary">مسجّل الدخول باسم</p>
          <p className="text-[15px] font-medium">{nurse}</p>
        </Card>

        <Button variant="secondary" icon="logout" onClick={() => (signOut(), navigate('/'))}>
          تسجيل الخروج
        </Button>

        <p className="text-center text-[12px] leading-5 text-tertiary">
          MEDGUARD نموذج أولي للهاكاثون — البيانات تجريبية وليست لمرضى حقيقيين.
        </p>
      </div>
    </Screen>
  )
}
