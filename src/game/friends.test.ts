import { describe, expect, it } from 'vitest'
import {
  decodeFriendCode,
  encodeFriendCode,
  friendInviteUrl,
  upsertFriend,
  type FriendCard,
} from './friends'

const sample: FriendCard = {
  id: 'pabc1234xyz',
  name: 'Miqo',
  bestMultiplier: 5.2,
  bestLayer: 6,
  streak: 3,
  updatedAt: 1_700_000_000_000,
}

describe('friends codes', () => {
  it('round-trips encode/decode', () => {
    const code = encodeFriendCode(sample)
    expect(code.startsWith('ZD1.')).toBe(true)
    const back = decodeFriendCode(code)
    expect(back).toMatchObject({
      id: sample.id,
      name: sample.name,
      bestMultiplier: sample.bestMultiplier,
      bestLayer: sample.bestLayer,
      streak: sample.streak,
    })
  })

  it('parses invite URL', () => {
    const url = friendInviteUrl(sample)
    const back = decodeFriendCode(url)
    expect(back?.name).toBe('Miqo')
  })

  it('upserts newer card', () => {
    const a = { ...sample, updatedAt: 100 }
    const b = { ...sample, bestMultiplier: 12, updatedAt: 200 }
    // isolate storage key via real localStorage in jsdom/vitest
    localStorage.clear()
    upsertFriend(a, 'self-id')
    const list = upsertFriend(b, 'self-id')
    expect(list).toHaveLength(1)
    expect(list[0].bestMultiplier).toBe(12)
  })
})
