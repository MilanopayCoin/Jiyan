import { beforeEach, describe, expect, it } from 'vitest'
import { getLayerInfo, fmtX } from './math'
import { applyFlightResult, defaultProfile } from './storage'
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
  it('matches prototype curve for first layers', () => {
    expect(getLayerInfo(1)).toMatchObject({ multiplier: 1.2, crashChance: 0.02 })
    expect(getLayerInfo(2)).toMatchObject({ multiplier: 1.5, crashChance: 0.05 })
    expect(getLayerInfo(5)).toMatchObject({ multiplier: 5, crashChance: 0.25 })
    expect(getLayerInfo(6).crashChance).toBeCloseTo(0.35)
    expect(getLayerInfo(6).multiplier).toBeGreaterThan(5)
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
    }
    const { profile: next } = applyFlightResult(profile, result, 0)
    expect(next.flightCredits).toBe(11)
    expect(next.flights).toBe(1)
    expect(next.safeLandings).toBe(1)
    expect(next.missions.find((m) => m.id === 'flights3')?.progress).toBe(1)
  })

  it('awards mission bonus credits', () => {
    const profile = {
      ...defaultProfile(),
      flightCredits: 10,
      missions: defaultProfile().missions.map((m) =>
        m.id === 'flights3'
          ? { ...m, progress: 2, completed: false }
          : m,
      ),
    }
    const result: FlightResult = {
      outcome: 'cashed',
      layer: 1,
      multiplier: 1.2,
      nearMissMultiplier: 1.5,
      timestamp: Date.now(),
    }
    const { profile: next } = applyFlightResult(profile, result, 0)
    expect(next.missions.find((m) => m.id === 'flights3')?.completed).toBe(true)
    expect(next.flightCredits).toBe(11) // +1 reward
  })
})
