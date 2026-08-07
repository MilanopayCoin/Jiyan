import {
  ASSETS,
  DEMO_PACK,
  LEDGER_KEY,
  MAX_LEDGER,
  type AssetBalances,
  type AssetId,
  type LedgerEntry,
  type LedgerKind,
  formatAsset,
  getAsset,
  isAssetId,
  normalizeBalances,
  roundAsset,
  stakeOptions,
} from './assets'
import type { PlayerProfile } from './types'

export type WalletResult =
  | { ok: true; balances: AssetBalances; entry: LedgerEntry; profilePatch: Partial<PlayerProfile> }
  | { ok: false; error: string }

export function loadLedger(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is LedgerEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as LedgerEntry).id === 'string' &&
        isAssetId((e as LedgerEntry).asset) &&
        typeof (e as LedgerEntry).amount === 'number',
    )
  } catch {
    return []
  }
}

function saveLedger(entries: LedgerEntry[]) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(entries.slice(0, MAX_LEDGER)))
}

function pushLedger(
  kind: LedgerKind,
  asset: AssetId,
  amount: number,
  note: string,
  address?: string,
): LedgerEntry {
  const entry: LedgerEntry = {
    id: `led-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    asset,
    amount,
    note,
    address,
    at: Date.now(),
  }
  saveLedger([entry, ...loadLedger()].slice(0, MAX_LEDGER))
  return entry
}

function applyBalance(
  profile: PlayerProfile,
  asset: AssetId,
  delta: number,
  kind: LedgerKind,
  note: string,
  address?: string,
): WalletResult {
  const balances = normalizeBalances(profile.balances)
  const next = roundAsset(balances[asset] + delta, asset)
  if (next < -1e-12) {
    return { ok: false, error: `Yetersiz ${getAsset(asset).symbol} bakiyesi` }
  }
  balances[asset] = Math.max(0, next)
  const entry = pushLedger(kind, asset, delta, note, address)
  return {
    ok: true,
    balances,
    entry,
    profilePatch: { balances, demoPackClaimed: profile.demoPackClaimed },
  }
}

/** One-time demo credit pack */
export function claimDemoPack(profile: PlayerProfile): WalletResult {
  if (profile.demoPackClaimed) {
    return { ok: false, error: 'Demo paketi zaten alındı' }
  }
  const balances = normalizeBalances(profile.balances)
  for (const id of Object.keys(DEMO_PACK) as AssetId[]) {
    balances[id] = roundAsset(balances[id] + DEMO_PACK[id], id)
  }
  const entry = pushLedger('demo', 'usdt', DEMO_PACK.usdt, 'Demo paket — USDT/USDC/ETH/SOL/BTC')
  return {
    ok: true,
    balances,
    entry,
    profilePatch: { balances, demoPackClaimed: true },
  }
}

/** Simulated deposit into play balance (demo / testnet style) */
export function depositAsset(
  profile: PlayerProfile,
  asset: AssetId,
  amount: number,
  address?: string,
): WalletResult {
  const meta = getAsset(asset)
  const amt = roundAsset(amount, asset)
  if (!(amt > 0)) return { ok: false, error: 'Geçersiz tutar' }
  if (amt < meta.minDeposit) {
    return { ok: false, error: `Min. ${formatAsset(meta.minDeposit, asset)}` }
  }
  if (amt > meta.maxDeposit) {
    return { ok: false, error: `Maks. ${formatAsset(meta.maxDeposit, asset)}` }
  }
  return applyBalance(
    profile,
    asset,
    amt,
    'deposit',
    `Yükleme +${formatAsset(amt, asset)}`,
    address,
  )
}

export function withdrawAsset(
  profile: PlayerProfile,
  asset: AssetId,
  amount: number,
  toAddress: string,
): WalletResult {
  const meta = getAsset(asset)
  const amt = roundAsset(amount, asset)
  const addr = toAddress.trim()
  if (!(amt > 0)) return { ok: false, error: 'Geçersiz tutar' }
  if (amt < meta.minWithdraw) {
    return { ok: false, error: `Min. çekim ${formatAsset(meta.minWithdraw, asset)}` }
  }
  if (addr.length < 8) return { ok: false, error: 'Geçerli cüzdan adresi gir' }
  const balances = normalizeBalances(profile.balances)
  if (balances[asset] < amt - 1e-12) {
    return { ok: false, error: `Yetersiz ${meta.symbol}` }
  }
  return applyBalance(
    profile,
    asset,
    -amt,
    'withdraw',
    `Çekim → ${addr.slice(0, 6)}…${addr.slice(-4)}`,
    addr,
  )
}

export function stakeForFlight(
  profile: PlayerProfile,
  asset: AssetId,
  amount: number,
): WalletResult {
  const amt = roundAsset(amount, asset)
  const opts = stakeOptions(asset)
  if (!opts.some((o) => Math.abs(o - amt) < 1e-12)) {
    return { ok: false, error: 'Geçersiz bahis tutarı' }
  }
  return applyBalance(profile, asset, -amt, 'stake', `Uçuş bahsi −${formatAsset(amt, asset)}`)
}

export function creditPayout(
  profile: PlayerProfile,
  asset: AssetId,
  amount: number,
  multiplier: number,
): WalletResult {
  const amt = roundAsset(amount, asset)
  if (!(amt > 0)) return { ok: false, error: 'Geçersiz ödeme' }
  return applyBalance(
    profile,
    asset,
    amt,
    'payout',
    `Cash-out ×${multiplier.toFixed(2)} +${formatAsset(amt, asset)}`,
  )
}

export function recordCrashStake(asset: AssetId, amount: number) {
  pushLedger('crash', asset, -amount, `Çöküş −${formatAsset(amount, asset)}`)
}

export function canStakeCrypto(profile: PlayerProfile, asset: AssetId, amount: number): boolean {
  if (!profile.payWithCrypto) return false
  const bal = normalizeBalances(profile.balances)[asset]
  return bal + 1e-12 >= amount
}

export { ASSETS, DEMO_PACK, formatAsset, getAsset, isAssetId, normalizeBalances, stakeOptions }
export type { AssetBalances, AssetId, LedgerEntry }
