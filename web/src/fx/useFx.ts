/**
 * Visual-effects + soundtrack preferences.
 * - calm: visitor turned the cyberpunk motion off (glitches, data rain, sweeps, marquee, boot).
 * - music: soundtrack on/off (default ON; it starts at the visitor's first click/tap/key, as browsers require).
 * Both persist per browser; storage failures are harmless.
 */
import { create } from 'zustand'
import { useMediaQuery } from '../lib/useMediaQuery'

const FX_KEY = 'qc.fx.v1'
const MUSIC_KEY = 'qc.music.v1'

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    /* blocked storage: the choice just won't be remembered */
  }
}

const saveData = () => {
  const c = (globalThis.navigator as Navigator & { connection?: { saveData?: boolean } } | undefined)?.connection
  return !!c?.saveData
}

interface FxState {
  calm: boolean
  music: boolean
  volume: number
  setCalm: (b: boolean) => void
  setMusic: (b: boolean) => void
  setVolume: (v: number) => void
}

export const useFx = create<FxState>((set) => ({
  calm: read(FX_KEY) === 'calm',
  music: read(MUSIC_KEY) !== null ? read(MUSIC_KEY) !== 'off' : !saveData(),
  volume: 0.35,
  setCalm: (calm) => {
    write(FX_KEY, calm ? 'calm' : 'on')
    set({ calm })
  },
  setMusic: (music) => {
    write(MUSIC_KEY, music ? 'on' : 'off')
    set({ music })
  },
  setVolume: (volume) => set({ volume }),
}))

/** True when animated effects should run (not calm, no reduced-motion preference). */
export function useFxActive(): boolean {
  const calm = useFx((s) => s.calm)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  return !calm && !reduced
}
