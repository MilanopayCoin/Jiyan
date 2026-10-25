import { describe, expect, it } from 'vitest'
import {
  applySpin,
  drawCard,
  makeLink,
  resolveBreak,
  sumMultiplier,
  type ChainLink,
} from './kader'

describe('kader', () => {
  it('sums multiplier from 1.0 base', () => {
    const links: ChainLink[] = [
      { id: 'a', card: 'hazine', delta: 0.5 },
      { id: 'b', card: 'sans', delta: 0.8 },
    ]
    expect(sumMultiplier(links)).toBe(2.3)
  })

  it('drawCard can return cokuş when forced', () => {
    expect(drawCard(0, () => 0)).toBe('cokuş')
  })

  it('shield consumes cokuş without crash', () => {
    const res = applySpin({
      links: [{ id: '1', card: 'hazine', delta: 0.4 }],
      shields: 1,
      card: 'cokuş',
      rng: () => 0.5,
    })
    expect(res.phase).toBe('choice')
    expect(res.shields).toBe(0)
  })

  it('cokuş without shield crashes', () => {
    const res = applySpin({
      links: [{ id: '1', card: 'hazine', delta: 0.4 }],
      shields: 0,
      card: 'cokuş',
    })
    expect(res.phase).toBe('crashed')
  })

  it('kirik opens break when chain long enough', () => {
    const res = applySpin({
      links: [
        { id: '1', card: 'hazine', delta: 0.3 },
        { id: '2', card: 'sans', delta: 0.5 },
      ],
      shields: 0,
      card: 'kirik',
      rng: () => 0.2,
    })
    expect(res.phase).toBe('break')
    expect(res.links).toHaveLength(3)
  })

  it('resolveBreak keeps head or tail', () => {
    const links: ChainLink[] = [
      { id: '1', card: 'hazine', delta: 0.2 },
      { id: '2', card: 'hazine', delta: 0.3 },
      { id: '3', card: 'sans', delta: 0.9 },
      { id: '4', card: 'ruzgar', delta: 0.1 },
    ]
    expect(resolveBreak(links, 'head').map((l) => l.id)).toEqual(['1', '2'])
    expect(resolveBreak(links, 'tail').map((l) => l.id)).toEqual(['3', '4'])
  })

  it('makeLink hazine is positive', () => {
    const link = makeLink('hazine', () => 0.5)
    expect(link.delta).toBeGreaterThan(0)
  })
})
