/** Rüzgar düellosu — seed-derived wind; tilt to catch or fight it. */

import { rngSeedFromString } from './fairness'

export type WindDir = 'L' | 'R' | 'F' | 'B'

export const WIND_CATCH_BONUS = 0.05 // +5% multiplier stack per catch
export const WIND_CATCH_CAP = 0.2 // max +20%
export const WIND_MISS_RISK = 0.05 // +5% crash chance when fighting wind
export const WIND_TILT_THRESHOLD = 0.35

export interface WindSample {
  dir: WindDir
  /** Player alignment: 1 catch, -1 fight, 0 neutral */
  align: -1 | 0 | 1
  label: string
}

export function windDirFromSeed(seed: string): WindDir {
  const dirs: WindDir[] = ['L', 'R', 'F', 'B']
  const n = Math.abs(rngSeedFromString(seed || 'wind')) % 4
  return dirs[n]!
}

export function windLabel(dir: WindDir): string {
  switch (dir) {
    case 'L':
      return '← Sol rüzgar'
    case 'R':
      return 'Sağ rüzgar →'
    case 'F':
      return '↑ İleri rüzgar'
    case 'B':
      return '↓ Geri rüzgar'
  }
}

/** Map device tilt (-1..1) to dominant wind direction, or null if flat. */
export function tiltToDir(x: number, y: number): WindDir | null {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax < WIND_TILT_THRESHOLD && ay < WIND_TILT_THRESHOLD) return null
  if (ax >= ay) return x < 0 ? 'L' : 'R'
  return y < 0 ? 'F' : 'B'
}

export function sampleWind(
  windDir: WindDir,
  tiltX: number,
  tiltY: number,
): WindSample {
  const player = tiltToDir(tiltX, tiltY)
  let align: -1 | 0 | 1 = 0
  if (player === windDir) align = 1
  else if (player != null) {
    const opposite: Record<WindDir, WindDir> = {
      L: 'R',
      R: 'L',
      F: 'B',
      B: 'F',
    }
    if (player === opposite[windDir]) align = -1
  }
  return { dir: windDir, align, label: windLabel(windDir) }
}

export function applyWindBonus(baseMultiplier: number, bonus: number): number {
  if (bonus <= 0) return baseMultiplier
  return Number((baseMultiplier * (1 + bonus)).toFixed(2))
}

export function windBonusFromCatches(catches: number): number {
  return Math.min(WIND_CATCH_CAP, Math.max(0, catches) * WIND_CATCH_BONUS)
}
