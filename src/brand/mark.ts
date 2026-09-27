/**
 * MEDGUARD brand mark: a stethoscope drawn as a heart with an ECG trace inside.
 * Single source of geometry for the React <Logo />, the app icons
 * (scripts/make-icons.mjs) and the printed labels (scripts/make-labels.mjs).
 *
 * 64×64 grid, uniform stroke with round caps and joins.
 */
export const MARK = {
  viewBox: '0 0 64 64',
  stroke: 3.4,
  /** Heart lobes = the two stethoscope tubes; the ear tips meet at the top dip. */
  heart:
    'M28.4 13.4C26 8.2 17.8 6.2 12.8 9.2 8.2 12 7.4 18.6 10.8 23.6 14.8 29.5 25.6 34.6 32 38.4' +
    'M35.6 13.4C38 8.2 46.2 6.2 51.2 9.2 55.8 12 56.6 18.6 53.2 23.6 49.2 29.5 38.4 34.6 32 38.4',
  /** Tube from the heart tip down-left into the chest piece. */
  tube: 'M32 38.4C31.2 44.6 26.8 50.4 19.6 51.5',
  pulse: 'M15.6 23.4H25.2L27.2 20 30 28.4 33 19.6 35.2 23.4H48.4',
  chestPiece: { cx: 16, cy: 51.8, r: 3.6 },
  dot: { cx: 16, cy: 51.8, r: 1.25 },
} as const

export const BRAND_COLORS = {
  blue: '#0E63A8',
  pulse: '#4A9BE0',
  tint: '#E6F0FA',
  ink: '#111827',
  dot: '#22A559',
  white: '#FFFFFF',
} as const

export type MarkPalette = { mark: string; pulse: string; dot: string }

/** Standalone SVG markup (no React), for icons and print. `inner` = extra elements drawn first (backgrounds). */
export function markSvg(p: MarkPalette, opts: { size?: number; viewBox?: string; inner?: string } = {}) {
  const { chestPiece: c, dot: d } = MARK
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${opts.viewBox ?? MARK.viewBox}"${size}>` +
    (opts.inner ?? '') +
    `<g fill="none" stroke-width="${MARK.stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${MARK.heart}" stroke="${p.mark}"/>` +
    `<path d="${MARK.tube}" stroke="${p.mark}"/>` +
    `<path d="${MARK.pulse}" stroke="${p.pulse}"/>` +
    `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" stroke="${p.mark}"/>` +
    `</g><circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${p.dot}"/></svg>`
  )
}
