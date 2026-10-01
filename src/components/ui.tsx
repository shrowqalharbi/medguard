import { useEffect, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

/* ------------------------------------------------------------------ Screen */

export function Screen({
  title,
  back,
  onBack,
  dark,
  footer,
  trailing,
  children,
}: {
  title?: string
  /** Route to go back to, or true for history back. */
  back?: string | boolean
  onBack?: () => void
  /** Camera screens use a dark canvas regardless of theme. */
  dark?: boolean
  footer?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  const goBack = () => {
    if (onBack) return onBack()
    if (typeof back === 'string') navigate(back)
    else navigate(-1)
  }
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-[430px] flex-col ${
        dark ? 'bg-[#0F1720] text-white' : 'bg-canvas text-primary'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {title !== undefined && (
        <header className={`sticky top-0 z-10 flex h-14 items-center gap-3 px-5 ${dark ? "bg-[#0F1720]" : "bg-canvas/95 backdrop-blur"}`}>
          {back && (
            <button
              onClick={goBack}
              aria-label="رجوع"
              className="-ms-2 grid h-10 w-10 place-items-center rounded-full active:bg-black/5"
            >
              {/* RTL: "back" points right */}
              <Icon name="chevronRight" size={22} />
            </button>
          )}
          <h1 className="flex-1 text-base font-semibold">{title}</h1>
          {trailing}
        </header>
      )}
      <main className="flex flex-1 flex-col px-5 pb-4">{children}</main>
      {footer && (
        <footer
          className={`sticky bottom-0 flex flex-col gap-2.5 px-5 pt-3 ${
            dark ? 'bg-[#0F1720]' : 'border-t border-line bg-canvas/95 backdrop-blur'
          }`}
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          {footer}
        </footer>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Button */

type Tone = 'brand' | 'safe' | 'warning' | 'critical'

const SOLID: Record<Tone, string> = {
  brand: 'bg-brand text-brand-on',
  safe: 'bg-safe-solid text-white',
  warning: 'bg-warning-solid text-white',
  critical: 'bg-critical-solid text-white',
}

export function Button({
  variant = 'primary',
  tone = 'brand',
  icon,
  className = '',
  children,
  ...rest
}: {
  variant?: 'primary' | 'secondary' | 'ghost'
  tone?: Tone
  icon?: IconName
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const look =
    variant === 'primary'
      ? SOLID[tone]
      : variant === 'secondary'
        ? 'border border-line bg-surface text-primary'
        : 'text-brand'
  return (
    <button
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md px-4 text-[15px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ Card */

export function Card({ className = '', children, ref }: { className?: string; children: ReactNode; ref?: Ref<HTMLElement> }) {
  return (
    <section ref={ref} className={`rounded-md border border-line bg-surface p-4 ${className}`}>
      {children}
    </section>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[13px]">
      <span className="shrink-0 text-secondary">{label}</span>
      <span className="text-end font-medium text-primary">{value}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ BottomSheet */

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div
        className="relative w-full max-w-[430px] animate-[sheet_.22s_ease-out] rounded-t-xl bg-surface px-5 pt-3"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line-strong" />
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ AiBadge */

export function AiBadge({ label = 'فرز MEDGUARD الذكي' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-[12px] font-medium text-brand">
      <Icon name="shield" size={12} />
      {label}
    </span>
  )
}
