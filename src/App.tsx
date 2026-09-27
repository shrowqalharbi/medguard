import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { applyTheme, getTheme } from './lib/prefs'
import { SessionProvider, useSession } from './lib/session'
import Calculator from './nurse/Calculator'
import HajjCard from './nurse/HajjCard'
import Home from './nurse/Home'
import Login from './nurse/Login'
import PatientProfile from './nurse/PatientProfile'
import Result from './nurse/Result'
import Settings from './nurse/Settings'

// The camera library is large: load it only when a scan screen opens.
const ScanPatient = lazy(() => import('./nurse/ScanPatient'))
const ScanDrug = lazy(() => import('./nurse/ScanDrug'))
const ScanHajj = lazy(() => import('./nurse/ScanHajj'))

function RequireNurse({ children }: { children: ReactNode }) {
  const { nurse } = useSession()
  return nurse ? <Suspense fallback={<div className="min-h-dvh bg-[#0F1720]" />}>{children}</Suspense> : <Navigate to="/" replace />
}

function Routed() {
  const { nurse } = useSession()
  const guard = (el: ReactNode) => <RequireNurse>{el}</RequireNurse>
  return (
    <Routes>
      <Route path="/" element={nurse ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/home" element={guard(<Home />)} />
      <Route path="/scan/patient" element={guard(<ScanPatient />)} />
      <Route path="/scan/drug" element={guard(<ScanDrug />)} />
      <Route path="/scan/hajj" element={guard(<ScanHajj />)} />
      <Route path="/hajj" element={guard(<HajjCard />)} />
      <Route path="/result" element={guard(<Result />)} />
      <Route path="/patient" element={guard(<PatientProfile />)} />
      <Route path="/calculator" element={guard(<Calculator />)} />
      <Route path="/settings" element={guard(<Settings />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    applyTheme(getTheme())
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => getTheme() === 'system' && applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <BrowserRouter>
      <SessionProvider>
        <Routed />
      </SessionProvider>
    </BrowserRouter>
  )
}
