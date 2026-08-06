/** Light haptic helpers — no-ops when Vibration API is unavailable */

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch {
    // ignore
  }
}

export const haptic = {
  tap: () => vibrate(12),
  climb: () => vibrate([18, 30, 18]),
  land: () => vibrate([40, 40, 80]),
  crash: () => vibrate([30, 40, 30, 40, 120]),
  warn: () => vibrate([10, 40, 10]),
}
