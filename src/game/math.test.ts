import { beforeEach, describe, expect, it } from 'vitest'
import { getLayerInfo, fmtX } from './math'
import {
  applyFlightResult,
  defaultProfile,
  unlockCraft,
} from './storage'
import type { FlightResult } from './types'

const mem = new Map<string, string>()
beforeEach(() => {
  mem.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
      removeItem: (k: string) => {
        mem.delete(k)
      },
    },
  })
})

describe('layer math', () => {
  it('matches drone prototype curve', () => {
    expect(getLayerInfo(1, 'drone')).toMatchObject({
      multiplier: 1.2,
      crashChance: 0.02,
    })
    expect(getLayerInfo(5, 'drone')).toMatchObject({
      multiplier: 5,
      crashChance: 0.25,
    })
  })

  it('rocket climbs faster and riskier than drone', () => {
    const d = getLayerInfo(3, 'drone')
    const r = getLayerInfo(3, 'rocket')
    expect(r.multiplier).toBeGreaterThan(d.multiplier)
    expect(r.crashChance).toBeGreaterThan(d.crashChance)
  })

  it('balloon is safest with lower ceiling', () => {
    expect(getLayerInfo(5, 'balloon').crashChance).toBeLessThan(
      getLayerInfo(5, 'drone').crashChance,
    )
    expect(getLayerInfo(5, 'balloon').multiplier).toBeLessThan(
      getLayerInfo(5, 'drone').multiplier,
    )
  })

  it('plane grows multipliers slower than drone', () => {
    expect(getLayerInfo(5, 'plane').multiplier).toBeLessThan(
      getLayerInfo(5, 'drone').multiplier,
    )
  })

  it('formats multipliers', () => {
    expect(fmtX(2)).toBe('2x')
    expect(fmtX(1.2)).toBe('1.2x')
  })
})

describe('flight result persistence', () => {
  it('does not double-spend credits (spent on takeoff)', () => {
    const profile = { ...defaultProfile(), flightCredits: 11 }
    const result: FlightResult = {
      outcome: 'cashed',
      layer: 2,
      multiplier: 1.5,
      nearMissMultiplier: 2,
      timestamp: Date.now(),
      craftId: 'drone',
      skinId: 'drone-default',
    }
    const { profile: next } = applyFlightResult(profile, result, 0)
    expect(next.flightCredits).toBe(11)
    expect(next.flights).toBe(1)
    expect(next.totalCashed).toBe(1.5)
  })

  it('unlocks balloon with credits', () => {
    const profile = { ...defaultProfile(), flightCredits: 10 }
    const res = unlockCraft(profile, 'balloon', 'credits')
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.profile.unlockedCrafts).toContain('balloon')
      expect(res.profile.flightCredits).toBe(5)
    }
  })
})
