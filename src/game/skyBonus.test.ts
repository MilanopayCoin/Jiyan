import { describe, expect, it } from 'vitest'
import {
  applySkyBonus,
  formatSkyBonus,
  skyBonusFromScore,
  SKY_SCORE_THRESHOLD,
} from '../utils/skyDetect'

describe('sky bonus', () => {
  it('gives no bonus below threshold', () => {
    const s = skyBonusFromScore(SKY_SCORE_THRESHOLD - 0.05)
    expect(s.active).toBe(false)
    expect(s.bonus).toBe(0)
  })

  it('gives 10–20% above threshold', () => {
    const mid = skyBonusFromScore(0.6)
    expect(mid.active).toBe(true)
    expect(mid.bonus).toBeGreaterThanOrEqual(0.1)
    expect(mid.bonus).toBeLessThanOrEqual(0.2)

    const full = skyBonusFromScore(1)
    expect(full.bonus).toBeCloseTo(0.2)
  })

  it('applies to multipliers', () => {
    expect(applySkyBonus(2, 0.1)).toBe(2.2)
    expect(applySkyBonus(5, 0.2)).toBe(6)
    expect(applySkyBonus(1.5, 0)).toBe(1.5)
  })

  it('formats label', () => {
    expect(formatSkyBonus(0.15)).toBe('+15%')
    expect(formatSkyBonus(0)).toBe('')
  })
})
