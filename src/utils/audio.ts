/**
 * Lightweight Web Audio SFX — no external libs.
 * Muted until unlock() (called on first user gesture).
 */

import type { CraftId } from '../game/types'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let unlocked = false
let propOsc: OscillatorNode | null = null
let propGain: GainNode | null = null
let staticGain: GainNode | null = null
let staticSrc: AudioBufferSourceNode | null = null
let noiseBuf: AudioBuffer | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.22
    master.connect(ctx.destination)
  }
  return ctx
}

function ensureNoise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf
  const len = c.sampleRate * 1.5
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuf = buf
  return buf
}

/** Resume AudioContext after a user gesture */
export async function unlockAudio(): Promise<void> {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      return
    }
  }
  unlocked = true
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.2,
  slideTo?: number,
): void {
  if (!unlocked) return
  const c = getCtx()
  if (!c || !master) return
  const now = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, slideTo),
      now + dur,
    )
  }
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(gain, now + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(now)
  osc.stop(now + dur + 0.02)
}

function noiseBurst(dur: number, gain = 0.15, filterFreq = 800): void {
  if (!unlocked) return
  const c = getCtx()
  if (!c || !master) return
  const now = c.currentTime
  const src = c.createBufferSource()
  src.buffer = ensureNoise(c)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  filter.Q.value = 0.7
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(now)
  src.stop(now + dur + 0.02)
}

const PROP_BASE: Record<CraftId, number> = {
  drone: 90,
  plane: 70,
  rocket: 45,
  balloon: 55,
}

export function startPropeller(craft: CraftId = 'drone'): void {
  if (!unlocked) return
  const c = getCtx()
  if (!c || !master) return
  stopPropeller()
  const now = c.currentTime
  propOsc = c.createOscillator()
  propGain = c.createGain()
  propOsc.type = craft === 'rocket' ? 'sawtooth' : 'sawtooth'
  propOsc.frequency.value = PROP_BASE[craft]
  propGain.gain.setValueAtTime(0.0001, now)
  propGain.gain.exponentialRampToValueAtTime(
    craft === 'balloon' ? 0.04 : 0.07,
    now + 0.3,
  )
  // Soft LFO wobble via second osc modulating gain slightly
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = craft === 'balloon' ? 0.8 : 4
  lfoGain.gain.value = craft === 'balloon' ? 0.008 : 0.015
  lfo.connect(lfoGain)
  lfoGain.connect(propGain.gain)
  propOsc.connect(propGain)
  propGain.connect(master)
  propOsc.start(now)
  lfo.start(now)
  ;(propOsc as OscillatorNode & { _lfo?: OscillatorNode })._lfo = lfo
}

export function setPropellerLayer(layer: number, craft: CraftId = 'drone'): void {
  if (!propOsc || !propGain || !ctx) return
  const now = ctx.currentTime
  const base = PROP_BASE[craft]
  propOsc.frequency.linearRampToValueAtTime(
    base + layer * (craft === 'rocket' ? 18 : 8),
    now + 0.2,
  )
  const vol = Math.min(
    0.12,
    (craft === 'balloon' ? 0.035 : 0.06) + layer * 0.008,
  )
  propGain.gain.linearRampToValueAtTime(vol, now + 0.2)
}

export function stopPropeller(): void {
  if (!ctx) return
  const now = ctx.currentTime
  if (propGain) {
    try {
      propGain.gain.cancelScheduledValues(now)
      propGain.gain.setValueAtTime(propGain.gain.value || 0.001, now)
      propGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    } catch {
      // ignore
    }
  }
  const osc = propOsc
  const lfo = osc
    ? (osc as OscillatorNode & { _lfo?: OscillatorNode })._lfo
    : undefined
  propOsc = null
  propGain = null
  if (osc) {
    try {
      osc.stop(now + 0.3)
    } catch {
      // ignore
    }
  }
  if (lfo) {
    try {
      lfo.stop(now + 0.3)
    } catch {
      // ignore
    }
  }
}

/** Radio static intensity 0–1 (LED danger / high altitude) */
export function setStaticLevel(level: number): void {
  if (!unlocked) return
  const c = getCtx()
  if (!c || !master) return
  const amt = Math.max(0, Math.min(1, level))

  if (amt < 0.05) {
    if (staticGain) {
      const now = c.currentTime
      staticGain.gain.linearRampToValueAtTime(0.0001, now + 0.2)
    }
    return
  }

  if (!staticSrc || !staticGain) {
    staticSrc = c.createBufferSource()
    staticSrc.buffer = ensureNoise(c)
    staticSrc.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 1200
    staticGain = c.createGain()
    staticGain.gain.value = 0.0001
    staticSrc.connect(filter)
    filter.connect(staticGain)
    staticGain.connect(master)
    staticSrc.start()
  }
  staticGain.gain.linearRampToValueAtTime(0.02 + amt * 0.06, c.currentTime + 0.15)
}

export function stopStatic(): void {
  if (!ctx || !staticGain) return
  const now = ctx.currentTime
  try {
    staticGain.gain.linearRampToValueAtTime(0.0001, now + 0.2)
  } catch {
    // ignore
  }
}

export const sfx = {
  unlock: unlockAudio,
  climb: (craft: CraftId = 'drone') => {
    unlockAudio()
    if (craft === 'rocket') {
      tone(180, 0.35, 'sawtooth', 0.12, 420)
      noiseBurst(0.25, 0.1, 400)
    } else if (craft === 'balloon') {
      tone(220, 0.4, 'sine', 0.08, 280)
    } else if (craft === 'plane') {
      tone(140, 0.3, 'triangle', 0.1, 200)
      tone(280, 0.2, 'sine', 0.05, 320)
    } else {
      tone(160, 0.22, 'square', 0.06, 240)
      tone(320, 0.18, 'triangle', 0.04, 400)
    }
  },
  land: (craft: CraftId = 'drone') => {
    unlockAudio()
    stopPropeller()
    stopStatic()
    tone(420, 0.15, 'sine', 0.1)
    tone(560, 0.2, 'sine', 0.08, 680)
    if (craft === 'rocket') tone(200, 0.3, 'triangle', 0.06, 100)
  },
  crash: (craft: CraftId = 'drone') => {
    unlockAudio()
    stopPropeller()
    stopStatic()
    noiseBurst(0.55, 0.28, craft === 'rocket' ? 300 : 600)
    tone(180, 0.45, 'sawtooth', 0.14, 40)
    tone(90, 0.6, 'square', 0.1, 30)
  },
  bomb: () => {
    unlockAudio()
    tone(520, 0.12, 'sine', 0.1)
    tone(780, 0.2, 'triangle', 0.08, 980)
    noiseBurst(0.15, 0.06, 2000)
  },
  warn: () => {
    unlockAudio()
    tone(880, 0.08, 'square', 0.05)
    tone(660, 0.1, 'square', 0.04)
  },
  startProp: startPropeller,
  setPropLayer: setPropellerLayer,
  stopProp: stopPropeller,
  setStatic: setStaticLevel,
  stopStatic,
}
