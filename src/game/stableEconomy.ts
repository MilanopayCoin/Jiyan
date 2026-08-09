/** Stablecoin play economy — USDT/USDC tables + USD display */

import {
  type AssetBalances,
  type AssetId,
  ASSETS,
  isAssetId,
  roundAsset,
} from './assets'
import { DEMO_USD } from './retention'

export type StableId = 'usdt' | 'usdc'
export type HighRollerId = 'sol' | 'eth' | 'btc'

export const STABLE_ASSETS: StableId[] = ['usdt', 'usdc']
export const HIGH_ROLLER_ASSETS: HighRollerId[] = ['sol', 'eth', 'btc']

/** Dollar table stakes (1 unit = $1 USDT/USDC) */
export const DOLLAR_TABLES = [1, 5, 10] as const
export type DollarTable = (typeof DOLLAR_TABLES)[number]

/** First-open instant USDC credit (before demo pack) */
export const INSTANT_USDC = 10

export function isStableAsset(id: unknown): id is StableId {
  return id === 'usdt' || id === 'usdc'
}

export function isHighRollerAsset(id: unknown): id is HighRollerId {
  return id === 'sol' || id === 'eth' || id === 'btc'
}

export function ensurePlayAsset(id: unknown): StableId | HighRollerId {
  if (isStableAsset(id) || isHighRollerAsset(id)) return id
  return 'usdc'
}

export function formatUsd(amount: number): string {
  const n = Number(amount) || 0
  if (Math.abs(n) < 0.005) return '$0.00'
  return `$${n.toFixed(2)}`
}

/** Signed USDC line for receipts: +$3.40 / −$1.00 */
export function formatUsdcDelta(amount: number): string {
  const n = Number(amount) || 0
  const abs = formatUsd(Math.abs(n))
  if (n > 0.0005) return `+${abs} USDC`
  if (n < -0.0005) return `−${abs.slice(1)} USDC`
  return `${abs} USDC`
}

export function formatPlayAmount(
  amount: number,
  asset: AssetId,
  highRoller = false,
): string {
  const usdc = toUsdcAmount(amount, asset)
  if (!highRoller || isStableAsset(asset)) {
    return `${formatUsd(usdc)} USDC`
  }
  return `${formatUsd(usdc)} USDC · ${ASSETS[asset].symbol}`
}

export function assetToUsd(amount: number, asset: AssetId): number {
  return roundAsset(amount * (DEMO_USD[asset] ?? 0), 'usdc')
}

export function usdToAsset(usd: number, asset: AssetId): number {
  const rate = DEMO_USD[asset] || 1
  if (rate <= 0) return 0
  return roundAsset(usd / rate, asset)
}

/** Convert any play balance slice into USDC amount (demo FX) */
export function toUsdcAmount(amount: number, from: AssetId): number {
  if (from === 'usdc') return roundAsset(amount, 'usdc')
  if (from === 'usdt') return roundAsset(amount, 'usdc') // 1:1
  return assetToUsd(amount, from)
}

export function totalUsdBalance(balances: AssetBalances): number {
  let sum = 0
  for (const id of Object.keys(balances) as AssetId[]) {
    sum += assetToUsd(balances[id] ?? 0, id)
  }
  return roundAsset(sum, 'usdc')
}

export function stakePresets(asset: AssetId, highRoller: boolean): number[] {
  if (!highRoller && isStableAsset(asset)) {
    return [...DOLLAR_TABLES]
  }
  return ASSETS[asset].stakes
}

export function defaultStakeFor(asset: AssetId, highRoller: boolean): number {
  if (!highRoller && isStableAsset(asset)) return 1
  return ASSETS[asset].flightStake
}

export function clampPlayAsset(
  asset: AssetId,
  highRoller: boolean,
): AssetId {
  if (highRoller) {
    return isAssetId(asset) ? asset : 'sol'
  }
  return isStableAsset(asset) ? asset : 'usdc'
}
