import {
  type AssetId,
  formatAsset,
  normalizeBalances,
  roundAsset,
  LEDGER_KEY,
  MAX_LEDGER,
  type LedgerEntry,
} from './assets'
import type { PlayerProfile } from './types'
import { toUsdcAmount } from './stableEconomy'

const WITHDRAW_QUEUE_KEY = 'zincir-drone-withdraw-queue-v1'
const MAX_QUEUE = 40

/** Withdraw fee in USDC terms */
export const WITHDRAW_FEE_BPS = 200 // 2%
export const WITHDRAW_MIN_FEE_USDC = 0.25

export type WithdrawStatus = 'pending' | 'sent' | 'cancelled'

export interface WithdrawRequest {
  id: string
  /** Source play asset that was burned/converted */
  sourceAsset: AssetId
  /** Gross source amount deducted */
  sourceAmount: number
  /** Always settle as USDC */
  asset: 'usdc'
  /** Gross USDC equivalent before fee */
  amount: number
  fee: number
  /** Net USDC to receive on-chain */
  net: number
  toAddress: string
  status: WithdrawStatus
  createdAt: number
  note?: string
}

export function calcUsdcWithdrawFee(grossUsdc: number): { fee: number; net: number } {
  const pct = roundAsset((grossUsdc * WITHDRAW_FEE_BPS) / 10_000, 'usdc')
  const fee = roundAsset(Math.max(pct, WITHDRAW_MIN_FEE_USDC), 'usdc')
  const net = roundAsset(Math.max(0, grossUsdc - fee), 'usdc')
  return { fee, net }
}

/** @deprecated use calcUsdcWithdrawFee — kept for UI preview helpers */
export function calcWithdrawFee(asset: AssetId, amount: number): {
  fee: number
  net: number
  usdcGross: number
} {
  const usdcGross = toUsdcAmount(amount, asset)
  const { fee, net } = calcUsdcWithdrawFee(usdcGross)
  return { fee, net, usdcGross }
}

export function loadWithdrawQueue(): WithdrawRequest[] {
  try {
    const raw = localStorage.getItem(WITHDRAW_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is WithdrawRequest =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as WithdrawRequest).id === 'string' &&
        typeof (e as WithdrawRequest).amount === 'number',
    )
  } catch {
    return []
  }
}

function saveQueue(list: WithdrawRequest[]) {
  localStorage.setItem(
    WITHDRAW_QUEUE_KEY,
    JSON.stringify(list.slice(0, MAX_QUEUE)),
  )
}

function pushLedgerNote(
  kind: LedgerEntry['kind'],
  asset: AssetId,
  amount: number,
  note: string,
  address?: string,
) {
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    const prev = raw ? (JSON.parse(raw) as LedgerEntry[]) : []
    const list = Array.isArray(prev) ? prev : []
    const entry: LedgerEntry = {
      id: `led-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      asset,
      amount,
      note,
      address,
      at: Date.now(),
    }
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([entry, ...list].slice(0, MAX_LEDGER)),
    )
  } catch {
    // ignore
  }
}

export type QueueWithdrawResult =
  | {
      ok: true
      request: WithdrawRequest
      balances: ReturnType<typeof normalizeBalances>
      profilePatch: Partial<PlayerProfile>
    }
  | { ok: false; error: string }

/**
 * Deduct source asset, convert to USDC settlement, enqueue pending withdraw.
 * Net payout is always USDC.
 */
export function queueWithdraw(
  profile: PlayerProfile,
  asset: AssetId,
  amount: number,
  toAddress: string,
): QueueWithdrawResult {
  const amt = roundAsset(amount, asset)
  const addr = toAddress.trim()
  if (!(amt > 0)) return { ok: false, error: 'Geçersiz tutar' }
  if (addr.length < 8) return { ok: false, error: 'Geçerli cüzdan adresi gir' }

  const usdcGross = toUsdcAmount(amt, asset)
  if (usdcGross < 1) {
    return { ok: false, error: 'Min. çekim ≈ $1 USDC karşılığı' }
  }
  const { fee, net } = calcUsdcWithdrawFee(usdcGross)
  if (net <= 0) return { ok: false, error: 'Ücret sonrası net tutar 0' }

  const balances = normalizeBalances(profile.balances)
  if (balances[asset] < amt - 1e-12) {
    return { ok: false, error: `Yetersiz ${asset.toUpperCase()}` }
  }
  balances[asset] = roundAsset(balances[asset] - amt, asset)

  const request: WithdrawRequest = {
    id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceAsset: asset,
    sourceAmount: amt,
    asset: 'usdc',
    amount: usdcGross,
    fee,
    net,
    toAddress: addr,
    status: 'pending',
    createdAt: Date.now(),
    note: `Çekim → USDC: −${formatAsset(amt, asset)} ≈ $${usdcGross.toFixed(2)} (ücret $${fee.toFixed(2)}, net $${net.toFixed(2)})`,
  }
  saveQueue([request, ...loadWithdrawQueue()].slice(0, MAX_QUEUE))
  pushLedgerNote('withdraw', asset, -amt, request.note!, addr)

  return {
    ok: true,
    request,
    balances,
    profilePatch: { balances },
  }
}

export function cancelWithdraw(
  profile: PlayerProfile,
  requestId: string,
): QueueWithdrawResult {
  const list = loadWithdrawQueue()
  const idx = list.findIndex((r) => r.id === requestId)
  if (idx < 0) return { ok: false, error: 'Talep bulunamadı' }
  const req = list[idx]!
  if (req.status !== 'pending') {
    return { ok: false, error: 'Sadece bekleyen çekim iptal edilebilir' }
  }

  const source = req.sourceAsset ?? req.asset
  const refund = req.sourceAmount ?? req.amount
  const balances = normalizeBalances(profile.balances)
  balances[source] = roundAsset(balances[source] + refund, source)
  list[idx] = { ...req, status: 'cancelled' }
  saveQueue(list)
  pushLedgerNote(
    'deposit',
    source,
    refund,
    `Çekim iptal iadesi +${formatAsset(refund, source)}`,
  )

  return {
    ok: true,
    request: list[idx]!,
    balances,
    profilePatch: { balances },
  }
}

export function creditOnChainDeposit(
  profile: PlayerProfile,
  amount: number,
  signature: string,
  asset: 'sol' | 'usdc' = 'sol',
):
  | {
      ok: true
      balances: ReturnType<typeof normalizeBalances>
      profilePatch: Partial<PlayerProfile>
    }
  | { ok: false; error: string } {
  const amt = roundAsset(amount, asset)
  if (!(amt > 0)) return { ok: false, error: 'Geçersiz tutar' }
  const balances = normalizeBalances(profile.balances)
  balances[asset] = roundAsset(balances[asset] + amt, asset)
  pushLedgerNote(
    'deposit',
    asset,
    amt,
    `On-chain ${asset.toUpperCase()} +${formatAsset(amt, asset)} · ${signature.slice(0, 8)}…`,
    signature,
  )
  return {
    ok: true,
    balances,
    profilePatch: { balances },
  }
}
