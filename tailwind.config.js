/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

const status = (name) => ({
  bg: token(`${name}-bg`),
  border: token(`${name}-border`),
  fg: token(`${name}-fg`),
  solid: token(`${name}-solid`),
})

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: token('bg-base'),
        surface: token('bg-surface'),
        'surface-2': token('bg-surface-2'),
        overlay: token('bg-overlay'),
        primary: token('text-primary'),
        secondary: token('text-secondary'),
        tertiary: token('text-tertiary'),
        line: token('border-default'),
        'line-strong': token('border-strong'),
        brand: {
          DEFAULT: token('brand'),
          hover: token('brand-hover'),
          subtle: token('brand-subtle'),
          on: token('on-brand'),
        },
        safe: status('safe'),
        renal: status('renal'),
        interaction: status('interaction'),
        critical: status('critical'),
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '22px',
      },
    },
  },
  plugins: [],
}
