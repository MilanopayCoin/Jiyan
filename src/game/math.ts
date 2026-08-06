import type { LayerInfo, LedLevel } from './types'

/** Layer N (1-based) multiplier & crash probability */
export function getLayerInfo(layer: number): LayerInfo {
  const multipliers = [1.2, 1.5, 2.0, 3.0, 5.0]
  const chances = [0.02, 0.05, 0.09, 0.15, 0.25]

  if (layer <= 5) {
    return {
      layer,
      multiplier: multipliers[layer - 1],
      crashChance: chances[layer - 1],
    }
  }

  // Layer 6+: +10% crash chance each layer (capped), multiplier doubles from 5x base growth
  const extra = layer - 5
  const crashChance = Math.min(0.92, 0.25 + extra * 0.1)
  const multiplier = Number((5 * Math.pow(1.6, extra)).toFixed(2))

  return { layer, multiplier, crashChance }
}

export function rollCrash(layer: number): boolean {
  const { crashChance } = getLayerInfo(layer)
  return Math.random() < crashChance
}

export function getLedLevel(layer: number): LedLevel {
  const { crashChance } = getLayerInfo(layer)
  if (crashChance < 0.12) return 'safe'
  if (crashChance < 0.3) return 'caution'
  return 'critical'
}

export function fmtX(m: number): string {
  if (Number.isInteger(m)) return `${m}x`
  const s = m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${s}x`
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
