/** Per-device preferences. Storage can throw (private mode), so every access is guarded. */

export type ThemePref = 'system' | 'light' | 'dark'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export const getTheme = (): ThemePref => (read('medguard.theme') as ThemePref) ?? 'system'

export function applyTheme(pref: ThemePref) {
  write('medguard.theme', pref)
  const dark =
    pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export const getSound = () => read('medguard.sound') !== 'off'
export const setSound = (on: boolean) => write('medguard.sound', on ? 'on' : 'off')

/** Demo mode shows "simulate scan" shortcuts, for stage backup only. */
export const getDemo = () => read('medguard.demo') === 'on'
export const setDemo = (on: boolean) => write('medguard.demo', on ? 'on' : 'off')

export const getNurse = () => read('medguard.nurse')
export const setNurse = (name: string | null) =>
  name ? write('medguard.nurse', name) : write('medguard.nurse', '')
