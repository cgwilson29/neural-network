import { useEffect, useState } from 'react'
import { useFxActive } from './useFx'
import { readTourMemory } from '../tour/storage'
import { metrics } from '../lib/artifacts'

const LINES = [
  'QUEUE//CARTOGRAPHY  v2.0',
  'LINKING NEURAL MESH ............ OK',
  'ONNX RUNTIME WEB ............... OK',
  `LOADING 433 WEIGHTS ............ OK`,
  `TEST MAE ${metrics.headline.nnMae.toFixed(2)} MIN · BASELINE ${metrics.headline.baselineMae.toFixed(2)} MIN`,
  'DATA: 2,000 SYNTHETIC VISITS',
  'RENDERING WAIT LANDSCAPE ▮',
]

/**
 * First-visit terminal boot (~1.6 s), only when effects are on. Click / key skips it; that gesture
 * also unlocks the soundtrack. Returning visitors never see it.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const active = useFxActive()
  const [show] = useState(() => readTourMemory() === null)
  const [n, setN] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!show || !active) {
      onDone()
      return
    }
    const id = window.setInterval(() => setN((x) => x + 1), 200)
    const end = window.setTimeout(finish, 1700)
    const skip = () => finish()
    window.addEventListener('keydown', skip, { once: true })
    function finish() {
      window.clearInterval(id)
      window.clearTimeout(end)
      window.removeEventListener('keydown', skip)
      setGone(true)
      onDone()
    }
    return () => {
      window.clearInterval(id)
      window.clearTimeout(end)
      window.removeEventListener('keydown', skip)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!show || !active || gone) return null
  return (
    <div
      className="boot"
      role="status"
      aria-label="Loading"
      onClick={() => {
        setGone(true)
        onDone()
      }}
    >
      <pre>
        {LINES.slice(0, n).join('\n')}
        <span className="caret">_</span>
      </pre>
      <p className="boot-skip">click or press any key</p>
    </div>
  )
}
