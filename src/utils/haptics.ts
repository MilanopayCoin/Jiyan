/** Light haptic helpers — Telegram HapticFeedback when in Mini App, else Vibration API */

import type { CraftId } from '../game/types'
import { tgHaptic } from '../telegram/webApp'

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
  kite: {
    tap: 10,
    climb: [8, 25, 8, 25, 8],
    land: [15, 40, 60],
    crash: [20, 30, 20, 30, 20, 100],
  },
  ufo: {
    tap: 16,
    climb: [30, 20, 30],
    land: [40, 20, 40, 80],
    crash: [50, 40, 50, 40, 140],
  },
  paper: {
    tap: 6,
    climb: [10, 35, 10],
    land: [25, 45, 35],
    crash: [12, 50, 12, 80],
  },
}

export const haptic = {
  tap: (craft: CraftId = 'drone') => {
    tgHaptic('light')
    vibrate(CRAFT_HAPTICS[craft].tap)
  },
  climb: (craft: CraftId = 'drone') => {
    tgHaptic('medium')
    vibrate(CRAFT_HAPTICS[craft].climb)
  },
  land: (craft: CraftId = 'drone') => {
    tgHaptic('success')
    vibrate(CRAFT_HAPTICS[craft].land)
  },
  crash: (craft: CraftId = 'drone') => {
    tgHaptic('error')
    vibrate(CRAFT_HAPTICS[craft].crash)
  },
  warn: () => {
    tgHaptic('warning')
    vibrate([10, 40, 10])
  },
  unlock: () => {
    tgHaptic('success')
    vibrate([20, 30, 20, 30, 60])
  },
  bomb: () => {
    tgHaptic('heavy')
    vibrate([25, 20, 45, 20, 70])
  },
}
