/** Multi-asset play wallet — USDT / USDC / ETH / SOL / BTC */

export type AssetId = 'usdt' | 'usdc' | 'eth' | 'sol' | 'btc'

export type AssetChain = 'ethereum' | 'solana' | 'bitcoin'

export interface AssetDef {
  id: AssetId
  symbol: string
  name: string
  chain: AssetChain
  chainLabel: string
  decimals: number
  /** Default stake per flight */
  flightStake: number
  /** Preset stake amounts */
  stakes: number[]
  minDeposit: number
  maxDeposit: number
  minWithdraw: number
  color: string
}

export const ASSET_ORDER: AssetId[] = ['usdt', 'usdc', 'sol', 'eth', 'btc']

export const ASSETS: Record<AssetId, AssetDef> = {
  usdt: {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether',
    chain: 'ethereum',
    chainLabel: 'Ethereum',
    decimals: 2,
    flightStake: 1,
    stakes: [1, 5, 10],
    minDeposit: 1,
    maxDeposit: 10_000,
    minWithdraw: 1,
    color: '#26a17b',
  },
  usdc: {
    id: 'usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'solana',
    chainLabel: 'Solana',
    decimals: 2,
    flightStake: 1,
    stakes: [1, 5, 10],
    minDeposit: 1,
    maxDeposit: 10_000,
    minWithdraw: 1,
    color: '#2775ca',
  },
  eth: {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    chain: 'ethereum',
    chainLabel: 'Ethereum',
    decimals: 5,
    flightStake: 0.0004,
    stakes: [0.0002, 0.0004, 0.001, 0.002, 0.005],
    minDeposit: 0.001,
    maxDeposit: 50,
    minWithdraw: 0.001,
    color: '#627eea',
  },
  sol: {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    chain: 'solana',
    chainLabel: 'Solana',
    decimals: 4,
    flightStake: 0.01,
    stakes: [0.005, 0.01, 0.025, 0.05, 0.1],
    minDeposit: 0.01,
    maxDeposit: 500,
    minWithdraw: 0.01,
    color: '#9945ff',
  },
  btc: {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    chain: 'bitcoin',
    chainLabel: 'Bitcoin',
    decimals: 6,
    flightStake: 0.00002,
    stakes: [0.00001, 0.00002, 0.00005, 0.0001, 0.00025],
    minDeposit: 0.0001,
    maxDeposit: 5,
    minWithdraw: 0.0001,
    color: '#f7931a',
  },
}

export type AssetBalances = Record<AssetId, number>

export function emptyBalances(): AssetBalances {
  return { usdt: 0, usdc: 0, eth: 0, sol: 0, btc: 0 }
}

export function normalizeBalances(raw: unknown): AssetBalances {
  const base = emptyBalances()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const id of ASSET_ORDER) {
    const v = o[id]
    base[id] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
  }
  return base
}

export function getAsset(id: AssetId): AssetDef {
  return ASSETS[id]
}

export function isAssetId(v: unknown): v is AssetId {
  return typeof v === 'string' && ASSET_ORDER.includes(v as AssetId)
}

export function formatAsset(amount: number, asset: AssetId): string {
  const def = ASSETS[asset]
  const n = Number(amount) || 0
  if (n === 0) return `0 ${def.symbol}`
  return `${n.toFixed(def.decimals)} ${def.symbol}`
}

export function roundAsset(amount: number, asset: AssetId): number {
  const d = ASSETS[asset].decimals
  const f = 10 ** Math.min(d, 8)
  return Math.round(amount * f) / f
}

export function stakeOptions(asset: AssetId): number[] {
  return ASSETS[asset].stakes
}

export type LedgerKind =
  | 'deposit'
  | 'withdraw'
  | 'stake'
  | 'payout'
  | 'crash'
  | 'demo'

export interface LedgerEntry {
  id: string
  kind: LedgerKind
  asset: AssetId
  amount: number
  note: string
  address?: string
  at: number
}

export const LEDGER_KEY = 'zincir-drone-ledger-v1'
export const MAX_LEDGER = 80

/** Demo welcome pack so users can try play-to-earn */
export const DEMO_PACK: AssetBalances = {
  usdt: 25,
  usdc: 25,
  sol: 0.5,
  eth: 0.02,
  btc: 0.001,
}

/** Instant USDC on first open (separate from full demo pack) */
export const INSTANT_USDC_CREDIT = 10


export const LEDGER_LABELS: Record<LedgerKind, string> = {
  deposit: 'Yükleme',
  withdraw: 'Çekim',
  stake: 'Bahis',
  payout: 'Kazanç',
  crash: 'Çöküş',
  demo: 'Demo',
}
