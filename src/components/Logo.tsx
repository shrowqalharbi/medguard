import { MARK } from '../brand/mark'

type Variant = 'mark' | 'full-en' | 'full-ar'

const WORDMARK = {
  'full-en': { name: 'MEDGUARD', tagline: 'SCAN · VERIFY · ADMINISTER SAFER', dir: 'ltr' },
  'full-ar': { name: 'ميدقارد', tagline: 'امسح · تحقّق · أعطِ بأمان', dir: 'rtl' },
} as const

/**
 * MEDGUARD brand mark and lockups. Colours come from the --logo-* tokens, so the
 * logo follows the app theme; `tone` pins the light or dark palette instead.
 * `size` is the mark's height in px; the wordmark scales with it.
 */
export function Logo({
  variant = 'mark',
  tone,
  size = 40,
  className = '',
}: {
  variant?: Variant
  tone?: 'light' | 'dark'
  size?: number
  className?: string
}) {
  const toneClass = tone ? `logo-${tone}` : ''
  const { chestPiece: c, dot: d } = MARK
  const mark = (
    <svg
      viewBox={MARK.viewBox}
      width={size}
      height={size}
      fill="none"
      strokeWidth={MARK.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={MARK.heart} className="stroke-logo-mark" />
      <path d={MARK.tube} className="stroke-logo-mark" />
      <path d={MARK.pulse} className="stroke-logo-pulse" />
      <circle cx={c.cx} cy={c.cy} r={c.r} className="stroke-logo-mark" />
      <circle cx={d.cx} cy={d.cy} r={d.r} stroke="none" className="fill-logo-dot" />
    </svg>
  )

  if (variant === 'mark') {
    return (
      <span role="img" aria-label="MEDGUARD" className={`inline-flex ${toneClass} ${className}`}>
        {mark}
      </span>
    )
  }

  const w = WORDMARK[variant]
  const en = variant === 'full-en'
  return (
    <span
      role="img"
      aria-label={`${w.name} — ${w.tagline}`}
      dir={w.dir}
      className={`inline-flex items-center ${toneClass} ${className}`}
      style={{ gap: size * 0.14 }}
    >
      {mark}
      <span className="flex flex-col" aria-hidden="true">
        <span
          className={`font-bold leading-none text-logo-text ${en ? 'tracking-[0.02em]' : ''}`}
          style={{ fontSize: size * (en ? 0.45 : 0.42) }}
        >
          {w.name}
        </span>
        <span
          className={`whitespace-nowrap text-logo-tagline ${en ? 'font-semibold uppercase tracking-[0.2em]' : 'font-medium'}`}
          style={{ fontSize: size * (en ? 0.1 : 0.15), marginTop: size * (en ? 0.09 : 0.06) }}
        >
          {w.tagline}
        </span>
      </span>
    </span>
  )
}
