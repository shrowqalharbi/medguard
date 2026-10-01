import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { evaluate, type Decision, type Drug, type Patient, type ScannedPack } from '../engine'
import { drugs, interactions } from '../data'
import { rankWithClaude } from './ranking'
import { getNurse, setNurse } from './prefs'

/** Today's date for expiry checks, in local time. */
const today = () => new Date().toLocaleDateString('en-CA')

interface Session {
  nurse: string | null
  signIn: (name: string) => void
  signOut: () => void

  patient: Patient | null
  setPatient: (p: Patient | null) => void

  drug: Drug | null
  pack: ScannedPack | undefined
  decision: Decision | null
  /**
   * Runs the full check for the current pilgrim + a scanned drug.
   * The rules decide the colour on the device; Claude then orders the
   * non-critical alerts (2 s max, otherwise the fixed fallback order stays).
   */
  check: (drug: Drug, pack?: ScannedPack) => Promise<Decision>
  clearDrug: () => void
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [nurse, setNurseState] = useState<string | null>(() => getNurse() || null)
  const [patient, setPatientState] = useState<Patient | null>(null)
  const [drug, setDrug] = useState<Drug | null>(null)
  const [pack, setPack] = useState<ScannedPack | undefined>()
  const [decision, setDecision] = useState<Decision | null>(null)

  const setPatient = useCallback((p: Patient | null) => {
    setPatientState(p)
    setDrug(null)
    setDecision(null)
  }, [])

  const check = useCallback(
    async (d: Drug, pk?: ScannedPack) => {
      if (!patient) throw new Error('No patient selected')
      const ruled = evaluate({ patient, drug: d, pack: pk, today: today() }, { drugs, interactions })
      const result = await rankWithClaude(ruled)
      setDrug(d)
      setPack(pk)
      setDecision(result)
      return result
    },
    [patient],
  )

  const value = useMemo<Session>(
    () => ({
      nurse,
      signIn: (name) => {
        setNurse(name)
        setNurseState(name)
      },
      signOut: () => {
        setNurse(null)
        setNurseState(null)
        setPatient(null)
      },
      patient,
      setPatient,
      drug,
      pack,
      decision,
      check,
      clearDrug: () => {
        setDrug(null)
        setDecision(null)
      },
    }),
    [nurse, patient, setPatient, drug, pack, decision, check],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}
