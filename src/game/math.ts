import type { CraftId, LayerInfo, LedLevel } from './types'
import { CRAFTS } from './vehicles'

/** Layer N (1-based) multiplier & crash probability for a craft */
export function getLayerInfo(
  layer: number,
  craftId: CraftId = 'drone',
): LayerInfo {
  const craft = CRAFTS[craftId] ?? CRAFTS.drone

  if (layer <= 5) {
    return {
      layer,
      multiplier: craft.multipliers[layer - 1],
      crashChance: craft.crashChances[layer - 1],
    }
  }

  const extra = layer - 5
  const crashChance = Math.min(
    craft.crashCap,
    craft.crashChances[4] + extra * craft.crashStep,
  )
  const multiplier = Number(
    (craft.multGrowthBase * Math.pow(craft.multGrowthFactor, extra)).toFixed(2),
  )

  return { layer, multiplier, crashChance }
}

export function rollCrash(
  layer: number,
  craftId: CraftId = 'drone',
  shielded = false,
  rng: () => number = Math.random,
  /** Extra crash chance from fighting the wind (skill layer) */
  riskAdd = 0,
): boolean {
  // Always consume RNG so bomb/UFO shields stay fair & verifiable
  const roll = rng()
  if (shielded) return false
  const { crashChance } = getLayerInfo(layer, craftId)
  const chance = Math.min(0.95, crashChance + Math.max(0, riskAdd))
  return roll < chance
}

export function getLedLevel(
  layer: number,
  craftId: CraftId = 'drone',
): LedLevel {
  const { crashChance } = getLayerInfo(layer, craftId)
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
