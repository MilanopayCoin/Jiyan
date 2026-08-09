import { describe, expect, it } from 'vitest'
import {
  FRAGMENTS_TO_UNLOCK,
  PASS_TIERS,
  weekKey,
  weeklySeed,
  xpForWeeklyFlight,
} from './season'

describe('season', () => {
  it('formats ISO week key', () => {
    expect(weekKey(new Date('2026-08-09T12:00:00Z'))).toMatch(/^2026-W\d{2}$/)
  })

  it('builds weekly seed', () => {
    expect(weeklySeed('drone', '2026-W32')).toBe('zincir-week-2026-W32-drone')
  })

  it('grants more xp on cash-out', () => {
    expect(xpForWeeklyFlight('cashed', 3, 4)).toBeGreaterThan(
      xpForWeeklyFlight('crashed', 3, 4),
    )
  })

  it('has pass tiers under fragment unlock cost', () => {
    expect(PASS_TIERS.length).toBeGreaterThanOrEqual(3)
    expect(FRAGMENTS_TO_UNLOCK).toBe(3)
  })
})
