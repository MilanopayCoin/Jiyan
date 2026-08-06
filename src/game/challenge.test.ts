import { describe, expect, it } from 'vitest'
import { createRng, dailyChallengeSeed, hashSeed } from './challenge'
import { rollCrash } from './math'

describe('daily challenge rng', () => {
  it('same seed produces same sequence', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('daily seed is stable for day+craft', () => {
    expect(dailyChallengeSeed('2026-08-06', 'drone')).toBe(
      hashSeed('zincir-challenge-2026-08-06-drone'),
    )
  })

  it('challenge crash path is deterministic', () => {
    const seed = dailyChallengeSeed('2026-08-06', 'drone')
    const r1 = createRng(seed)
    const r2 = createRng(seed)
    const path1 = [1, 2, 3, 4, 5, 6, 7, 8].map((l) =>
      rollCrash(l, 'drone', false, r1),
    )
    const path2 = [1, 2, 3, 4, 5, 6, 7, 8].map((l) =>
      rollCrash(l, 'drone', false, r2),
    )
    expect(path1).toEqual(path2)
  })
})
