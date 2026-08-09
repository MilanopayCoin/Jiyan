import { describe, expect, it } from 'vitest'
import { parseRefStartParam, tgDisplayName } from './webApp'

describe('telegram webApp helpers', () => {
  it('parses ref start_param', () => {
    expect(parseRefStartParam('ref_pabc1234')).toBe('pabc1234')
    expect(parseRefStartParam('evil')).toBeNull()
    expect(parseRefStartParam(null)).toBeNull()
  })

  it('formats display name', () => {
    expect(
      tgDisplayName({ id: 1, first_name: 'Ada', username: 'ada_lovelace' }),
    ).toBe('ada_lovelace')
    expect(tgDisplayName({ id: 1, first_name: 'Pilot!!' })).toBe('Pilot')
  })
})
