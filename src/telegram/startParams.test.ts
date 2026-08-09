import { describe, expect, it } from 'vitest'
import { parseStartParam } from './startParams'

describe('parseStartParam', () => {
  it('parses ref duel chatBlind boost', () => {
    expect(parseStartParam('ref_pabc12')).toEqual({
      kind: 'ref',
      pilotId: 'pabc12',
    })
    expect(parseStartParam('d_ab12cd')).toEqual({ kind: 'duel', duelId: 'ab12cd' })
    expect(parseStartParam('cb_tok123')).toEqual({
      kind: 'chatBlind',
      token: 'tok123',
    })
    expect(parseStartParam('boost')).toEqual({ kind: 'boost' })
    expect(parseStartParam('nope')).toBeNull()
  })
})
