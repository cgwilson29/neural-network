import { useEffect, useRef } from 'react'
import { useFx, useFxActive } from './useFx'
import { useExhibit } from '../state/store'
import type { NeonSynth } from './synth'

/**
 * Soundtrack controller (renders nothing). Default ON: browsers only allow audio after a user gesture,
 * so it starts on the visitor's first click / tap / key press. Ducks while the guide bot is open,
 * pauses in background tabs, and drives a subtle beat pulse on the page when effects are on.
 */
export function Soundtrack() {
  const music = useFx((s) => s.music)
  const volume = useFx((s) => s.volume)
  const chatOpen = useExhibit((s) => s.chatOpen)
  const chatBusy = useExhibit((s) => s.chatGenerating)
  const fxActive = useFxActive()
  const synth = useRef<NeonSynth | null>(null)
  const gestured = useRef(false)
  const fxRef = useRef(fxActive)
  fxRef.current = fxActive

  const level = chatBusy || chatOpen ? volume * 0.28 : volume

  // First gesture anywhere → allowed to make sound.
  useEffect(() => {
    const onGesture = () => {
      gestured.current = true
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
      if (useFx.getState().music) ensureStarted()
    }
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    return () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ensureStarted() {
    if (!synth.current) {
      const { NeonSynth } = await import('./synth')
      synth.current = new NeonSynth({
        onBeat: (accent) => {
          if (!fxRef.current || document.hidden) return
          const el = document.documentElement
          el.classList.add(accent ? 'beat-accent' : 'beat')
          window.setTimeout(() => el.classList.remove('beat', 'beat-accent'), 140)
        },
      })
    }
    await synth.current.start(useFx.getState().volume)
  }

  // Toggle on/off (after the first gesture).
  useEffect(() => {
    if (!gestured.current) return
    if (music) ensureStarted().catch(() => undefined)
    else synth.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music])

  // Volume / ducking.
  useEffect(() => {
    if (music && synth.current?.ctx.state === 'running') synth.current.setVolume(level, 0.5)
  }, [level, music])

  // Pause in background tabs.
  useEffect(() => {
    const onVis = () => {
      const s = synth.current
      if (!s) return
      if (document.hidden) s.ctx.suspend().catch(() => undefined)
      else if (useFx.getState().music && gestured.current) s.ctx.resume().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => () => synth.current?.close(), [])
  return null
}
