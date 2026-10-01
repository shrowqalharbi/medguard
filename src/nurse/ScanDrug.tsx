import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Scanner } from '../components/Scanner'
import { BottomSheet, Button, Screen } from '../components/ui'
import { drugs } from '../data'
import type { Drug, ScannedPack } from '../engine'
import { getDemo } from '../lib/prefs'
import { resolveScan } from '../lib/resolve'
import { useSession } from '../lib/session'
import { unlockAudio } from '../lib/sound'

/** Demo shortcuts, in the order of the stage script. */
const DEMO_ORDER = ['paracetamol', 'metformin', 'ibuprofen', 'amoxicillin']

export default function ScanDrug() {
  const navigate = useNavigate()
  const { patient, check } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [checking, setChecking] = useState(false)
  const [search, setSearch] = useState(false)
  const [query, setQuery] = useState('')

  if (!patient) return <Navigate to="/scan/patient" replace />

  const run = async (drug: Drug, pack?: ScannedPack) => {
    setChecking(true)
    try {
      await check(drug, pack)
      navigate('/result')
    } catch {
      setChecking(false)
      setError('تعذّر إكمال الفحص. أعيدي المسح، وإن تكرر أبلغي الصيدلية.')
      setAttempt((n) => n + 1)
    }
  }

  const handle = (text: string) => {
    const r = resolveScan(text)
    if (r.kind === 'drug') return void run(r.drug, r.pack)
    setError(
      r.kind === 'patient'
        ? 'هذا سوار أو بطاقة حاج. امسحي الباركود الموجود على عبوة الدواء.'
        : 'هذا الدواء غير موجود في صيدلية المستشفى. تأكدي من العبوة أو ابحثي بالاسم.',
    )
    setAttempt((n) => n + 1)
  }

  const results = drugs.filter((d) =>
    [d.nameAr, d.nameEn, ...d.brandNames].some((n) => n.toLowerCase().includes(query.trim().toLowerCase())),
  )

  return (
    <Screen
      dark
      title="مسح باركود الدواء"
      back="/card"
      footer={
        <>
          {getDemo() && (
            <div className="grid grid-cols-4 gap-2">
              {DEMO_ORDER.map((id) => {
                const d = drugs.find((x) => x.id === id)!
                return (
                  <button
                    key={id}
                    onClick={() => (unlockAudio(), run(d))}
                    className="truncate rounded-md border border-white/15 px-1 py-2 text-[11px] text-white/70"
                  >
                    {d.nameAr}
                  </button>
                )
              })}
            </div>
          )}
          <Button variant="secondary" icon="search" onClick={() => (unlockAudio(), setSearch(true))}>
            البحث باسم الدواء
          </Button>
        </>
      }
    >
      <div className="flex flex-1 flex-col items-center gap-4 pt-2">
        <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px]">
          <Icon name="idCard" size={14} />
          <span className="truncate">
            {patient.name} — {patient.source === 'kkjh' ? 'KKJH' : 'هوية'} {patient.recordNo} — {patient.bed}
          </span>
        </span>

        {checking ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3" role="status">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-[#4FA3E8]" />
            <p className="text-[15px] font-medium">جارٍ الفحص الثلاثي…</p>
            <p className="text-[13px] text-white/55">الحساسية، التعارضات، والجرعة حسب الكلى</p>
          </div>
        ) : (
          <>
            <Scanner key={attempt} onResult={handle} aspect="wide" label="جارٍ البحث عن الباركود…" />
                <p className="text-center text-[15px] font-medium">وجّهي الكاميرا نحو باركود عبوة الدواء</p>
          </>
        )}

        {error && !checking && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-critical-solid/15 p-3 text-[13px] leading-6 text-[#FF8A8A]">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <BottomSheet open={search} onClose={() => setSearch(false)}>
        <div className="flex max-h-[70dvh] flex-col gap-3 text-primary">
          <label htmlFor="q" className="text-base font-semibold">
            البحث باسم الدواء
          </label>
          <input
            id="q"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثال: ميتفورمين أو Glucophage"
            className="h-12 rounded-md border border-line bg-surface px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand/40"
          />
          <ul className="-mx-2 overflow-y-auto">
            {results.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => (setSearch(false), run(d))}
                  className="flex w-full items-center justify-between rounded-md px-2 py-3 text-start active:bg-surface-2"
                >
                  <span>
                    <span className="block text-[15px] font-medium">
                      {d.nameAr} {d.strength}
                    </span>
                    <span className="block text-[12px] text-tertiary">
                      {d.nameEn} · {d.brandNames[0]}
                    </span>
                  </span>
                  <Icon name="chevronLeft" size={16} className="text-tertiary" />
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-2 py-6 text-center text-[13px] text-secondary">
                لا يوجد دواء بهذا الاسم في صيدلية المستشفى.
              </li>
            )}
          </ul>
        </div>
      </BottomSheet>
    </Screen>
  )
}
