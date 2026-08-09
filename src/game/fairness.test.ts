import { describe, expect, it } from 'vitest'
import {
  buildProof,
  makeFlightSeed,
  replayCrashFlags,
  rngSeedFromString,
  sha256Hex,
  verifyCommit,
  verifyFairness,
} from './fairness'
import { createRng } from './challenge'
import { rollCrash } from './math'

describe('fairness', () => {
  it('commit is sha256 of seed', async () => {
    const seed = makeFlightSeed('test')
    const commit = await sha256Hex(seed)
    expect(await verifyCommit(seed, commit)).toBe(true)
    expect(await verifyCommit(seed, 'deadbeef')).toBe(false)
  })

  it('replay matches live rolls', async () => {
    const seed = 'zd-test-seed-abc'
    const rng = createRng(rngSeedFromString(seed))
    const live: boolean[] = []
    for (let layer = 1; layer <= 5; layer++) {
      live.push(rollCrash(layer, 'drone', false, rng))
    }
    const replayed = replayCrashFlags(seed, 'drone', 5)
    expect(replayed).toEqual(live)
    const proof = await buildProof(seed, 'drone', 5)
    expect(verifyFairness(proof, 'drone')).toBe(true)
  })

  it('challenge seed string matches daily hash path', () => {
    const day = '2026-08-09'
    const seed = `zincir-challenge-${day}-drone`
    expect(rngSeedFromString(seed)).toBeGreaterThan(0)
  })
})
