import { getSound } from './prefs'

/**
 * Audio feedback. Deliberately asymmetric: green is silent, only red sounds.
 * Uses Web Audio so there is no file to load. iOS requires a prior user
 * gesture; the scan button tap provides it.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Call from any tap handler so iOS unlocks audio before a result arrives. */
export const unlockAudio = () => void audio()

function tone(freq: number, start: number, duration: number) {
  const a = audio()
  if (!a) return
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, a.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.35, a.currentTime + start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + duration)
  osc.connect(gain).connect(a.destination)
  osc.start(a.currentTime + start)
  osc.stop(a.currentTime + start + duration + 0.05)
}

export function playCritical() {
  if (!getSound()) return
  tone(880, 0, 0.18)
  tone(660, 0.22, 0.18)
  tone(880, 0.44, 0.3)
}

/** Short tick confirming a successful scan read. */
export function playScanTick() {
  if (!getSound()) return
  tone(1320, 0, 0.06)
}
