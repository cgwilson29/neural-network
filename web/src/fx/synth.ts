/**
 * "Neon Cartography" — an original synthwave loop composed in code and synthesized live with the
 * Web Audio API (no recordings, no third-party samples, nothing downloaded).
 *
 * 96 BPM in A minor. 16-bar form: two 8-bar progressions (Am–F–C–G, Am–F–G–Em), bass in 8ths,
 * a 16th-note arpeggio through a dotted-8th delay, detuned saw pads, and a drum machine
 * (four-on-the-floor kick, gated snare on 2 & 4, 8th hats). Scheduling uses the standard
 * look-ahead pattern so timing stays tight even when the page is busy.
 */

const BPM = 96
const SPB = 60 / BPM // seconds per beat
const S16 = SPB / 4

// MIDI note → Hz
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// Chords as MIDI notes (root position, octave 3–4). A=57.
const CHORDS: Record<string, number[]> = {
  Am: [57, 60, 64],
  F: [53, 57, 60],
  C: [48, 52, 55],
  G: [55, 59, 62],
  Em: [52, 55, 59],
}
const FORM = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'G']

export interface SynthOptions {
  onBeat?: (accent: boolean) => void
}

export class NeonSynth {
  readonly ctx: AudioContext
  private master: GainNode
  private bus: GainNode
  private reverb: ConvolverNode
  private delay: DelayNode
  private noise: AudioBuffer
  private timer: number | undefined
  private nextTime = 0
  private step = 0 // 16th-note counter
  private running = false
  private onBeat?: (accent: boolean) => void

  constructor(opts: SynthOptions = {}) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC()
    this.onBeat = opts.onBeat
    const ctx = this.ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)

    this.bus = ctx.createGain()
    this.bus.gain.value = 0.9
    this.bus.connect(this.master)

    // Reverb: exponentially decaying stereo noise impulse.
    this.reverb = ctx.createConvolver()
    const len = Math.floor(ctx.sampleRate * 2.6)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    this.reverb.buffer = ir
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    this.reverb.connect(wet).connect(this.master)

    // Dotted-8th feedback delay for the arp.
    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = SPB * 0.75
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const dlp = ctx.createBiquadFilter()
    dlp.type = 'lowpass'
    dlp.frequency.value = 2600
    this.delay.connect(dlp).connect(fb).connect(this.delay)
    dlp.connect(this.bus)

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const nd = this.noise.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  }

  /** Must be called from a user gesture the first time (browser autoplay rules). */
  async start(volume: number) {
    if (this.ctx.state !== 'running') await this.ctx.resume()
    if (!this.running) {
      this.running = true
      this.nextTime = this.ctx.currentTime + 0.1
      this.timer = window.setInterval(() => this.schedule(), 25)
    }
    this.setVolume(volume, 2.0)
  }

  stop() {
    this.setVolume(0, 0.6)
    window.setTimeout(() => {
      window.clearInterval(this.timer)
      this.running = false
      this.ctx.suspend().catch(() => undefined)
    }, 700)
  }

  setVolume(v: number, seconds = 0.4) {
    const g = this.master.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime + seconds)
  }

  close() {
    window.clearInterval(this.timer)
    this.ctx.close().catch(() => undefined)
  }

  // ---------------------------------------------------------------- scheduling
  private schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.play16th(this.step, this.nextTime)
      this.nextTime += S16
      this.step = (this.step + 1) % (FORM.length * 16)
    }
  }

  private play16th(step: number, t: number) {
    const bar = Math.floor(step / 16)
    const s = step % 16
    const chord = CHORDS[FORM[bar]]
    const intro = bar < 2 && step < 32 // gentle first two bars of each pass: pad + bass only

    if (s % 4 === 0) {
      if (!intro) this.kick(t)
      const delayMs = Math.max(0, (t - this.ctx.currentTime) * 1000)
      const accent = s === 0
      window.setTimeout(() => this.onBeat?.(accent), delayMs)
    }
    if (!intro && (s === 4 || s === 12)) this.snare(t)
    if (!intro && s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.09 : 0.05)
    if (s % 2 === 0) this.bass(hz(chord[0] - 12), t, s % 8 === 0 ? 0.22 : 0.16)
    if (s === 0) this.pad(chord, t, SPB * 4)
    if (!intro) {
      // up-down arpeggio over two octaves of the chord
      const tones = [...chord, chord[0] + 12, chord[1] + 12, chord[2] + 12]
      const order = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3]
      this.arp(hz(tones[order[s]] + 12), t)
    }
  }

  // ---------------------------------------------------------------- voices
  private env(g: GainNode, t: number, peak: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
    this.env(g, t, 0.9, 0.003, 0.3)
    o.connect(g).connect(this.bus)
    o.start(t)
    o.stop(t + 0.35)
  }

  private snare(t: number) {
    const n = this.ctx.createBufferSource()
    n.buffer = this.noise
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    const g = this.ctx.createGain()
    this.env(g, t, 0.35, 0.002, 0.22)
    n.connect(bp).connect(g)
    g.connect(this.bus)
    g.connect(this.reverb)
    n.start(t)
    n.stop(t + 0.3)
  }

  private hat(t: number, level: number) {
    const n = this.ctx.createBufferSource()
    n.buffer = this.noise
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 8000
    const g = this.ctx.createGain()
    this.env(g, t, level, 0.001, 0.05)
    n.connect(hp).connect(g).connect(this.bus)
    n.start(t)
    n.stop(t + 0.08)
  }

  private bass(f: number, t: number, level: number) {
    const o = this.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.18)
    lp.Q.value = 6
    const g = this.ctx.createGain()
    this.env(g, t, level, 0.005, S16 * 1.8)
    o.connect(lp).connect(g).connect(this.bus)
    o.start(t)
    o.stop(t + S16 * 2.2)
  }

  private arp(f: number, t: number) {
    const o = this.ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = f
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    const g = this.ctx.createGain()
    this.env(g, t, 0.05, 0.004, S16 * 0.9)
    o.connect(lp).connect(g)
    g.connect(this.bus)
    g.connect(this.delay)
    o.start(t)
    o.stop(t + S16)
  }

  private pad(chord: number[], t: number, dur: number) {
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(700, t)
    lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.5)
    lp.frequency.linearRampToValueAtTime(800, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.07, t + 0.6)
    g.gain.setValueAtTime(0.07, t + dur - 0.3)
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4)
    lp.connect(g)
    g.connect(this.bus)
    g.connect(this.reverb)
    for (const n of chord) {
      for (const detune of [-9, 9]) {
        const o = this.ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(n)
        o.detune.value = detune
        o.connect(lp)
        o.start(t)
        o.stop(t + dur + 0.5)
      }
    }
  }
}
