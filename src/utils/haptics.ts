/** Light haptic helpers — no-ops when Vibration API is unavailable */

import type { CraftId } from '../game/types'

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch {
    // ignore
  }
}

const CRAFT_HAPTICS: Record<
  CraftId,
  {
    tap: number | number[]
    climb: number | number[]
    land: number | number[]
    crash: number | number[]
  }
> = {
  drone: {
    tap: 12,
    climb: [18, 30, 18],
    land: [40, 40, 80],
    crash: [30, 40, 30, 40, 120],
  },
  plane: {
    tap: 10,
    climb: [25, 20, 25, 20, 35],
    land: [50, 30, 70],
    crash: [40, 50, 40, 80],
  },
  rocket: {
    tap: 20,
    climb: [45, 15, 55],
    land: [30, 20, 30, 20, 100],
    crash: [60, 30, 60, 30, 60, 150],
  },
  balloon: {
    tap: 8,
    climb: [12, 40, 12],
    land: [20, 50, 40],
    crash: [15, 60, 15, 60, 90],
  },
}

export const haptic = {
  tap: (craft: CraftId = 'drone') => vibrate(CRAFT_HAPTICS[craft].tap),
  climb: (craft: CraftId = 'drone') => vibrate(CRAFT_HAPTICS[craft].climb),
  land: (craft: CraftId = 'drone') => vibrate(CRAFT_HAPTICS[craft].land),
  crash: (craft: CraftId = 'drone') => vibrate(CRAFT_HAPTICS[craft].crash),
  warn: () => vibrate([10, 40, 10]),
  unlock: () => vibrate([20, 30, 20, 30, 60]),
}
