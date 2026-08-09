import { describe, expect, it } from 'vitest'
import {
  clampPlayAsset,
  formatUsd,
  isStableAsset,
  stakePresets,
  toUsdcAmount,
} from './stableEconomy'

describe('stableEconomy', () => {
  it('restricts play asset when not high roller', () => {
    expect(clampPlayAsset('sol', false)).toBe('usdc')
    expect(clampPlayAsset('usdt', false)).toBe('usdt')
    expect(clampPlayAsset('sol', true)).toBe('sol')
  })

  it('uses $1/$5/$10 tables for stables', () => {
    expect(stakePresets('usdc', false)).toEqual([1, 5, 10])
    expect(isStableAsset('usdc')).toBe(true)
  })

  it('converts to USDC 1:1 for stables', () => {
    expect(toUsdcAmount(5, 'usdt')).toBe(5)
    expect(toUsdcAmount(5, 'usdc')).toBe(5)
    expect(formatUsd(5)).toBe('$5.00')
  })
})
