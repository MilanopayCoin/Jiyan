import { describe, expect, it } from 'vitest'
import {
  applyWindBonus,
  sampleWind,
  tiltToDir,
  windBonusFromCatches,
  windDirFromSeed,
} from './wind'

describe('wind', () => {
  it('derives stable wind from seed', () => {
    expect(windDirFromSeed('abc')).toBe(windDirFromSeed('abc'))
  })

  it('maps tilt to direction', () => {
    expect(tiltToDir(-0.8, 0)).toBe('L')
    expect(tiltToDir(0.8, 0)).toBe('R')
    expect(tiltToDir(0, -0.8)).toBe('F')
    expect(tiltToDir(0, 0)).toBeNull()
  })

  it('aligns catch vs fight', () => {
    const catchSample = sampleWind('L', -0.9, 0)
    expect(catchSample.align).toBe(1)
    const fight = sampleWind('L', 0.9, 0)
    expect(fight.align).toBe(-1)
  })

  it('caps wind bonus', () => {
    expect(windBonusFromCatches(10)).toBe(0.2)
    expect(applyWindBonus(2, 0.05)).toBe(2.1)
  })
})
