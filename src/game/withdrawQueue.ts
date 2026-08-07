import {
  type AssetId,
  formatAsset,
  getAsset,
  normalizeBalances,
  roundAsset,
} from '../game/assets'
import type { PlayerProfile } from '../game/types'
import type { WalletResult } from '../game/walletOps'
import { depositAsset } from '../game/walletOps'

const WITHDRAW_QUEUE_KEY = 'zincir-drone-withdraw-queue-v1'
const MAX_QUEUE = 40

/** Flat % fee + per-asset minimum fee (play balance units) */
export const WITHDRAW_FEE_BPS = 200 // 2%
export const WITHDRAW_MIN_FEE: Record<AssetId, number> = {
  usdt: 0.25,
  usdc: 0.25,
  sol: 0.002,
  eth: 0.00008,
  btc: 0.000005,
}

export type WithdrawStatus = 'pending' | 'sent' | 'cancelled'

export interface WithdrawRequest {
  id: string
  asset: AssetId
  /** Gross amount deducted from play balance */
  amount: number
  fee: number
  /** Net amount to receive on-chain */
  net: number
  toAddress: string
  status: WithdrawStatus
  createdAt: number
  note?: string
}

export function calcWithdrawFee(asset: AssetId, amount: number): {
  fee: number
  net: number
} {
  const pct = roundAsset((amount * WITHDRAW_FEE_BPS) / 10_000, asset)
  const fee = roundAsset(Math.max(pct, WITHDRAW_MIN_FEE[asset]), asset)
  const net = roundAsset(Math.max(0, amount - fee), asset)
  return { fee, net }
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

export type QueueWithdrawResult =
  | {
      ok: true
      request: WithdrawRequest
      balances: ReturnType<typeof normalizeBalances>
      profilePatch: Partial<PlayerProfile>
    }
  | { ok: false; error: string }

/** Deduct balance + enqueue pending withdraw with transparent fee */
export function queueWithdraw(
  profile: PlayerProfile,
  asset: AssetId,
  amount: number,
  toAddress: string,
): QueueWithdrawResult {
  const meta = getAsset(asset)
  const amt = roundAsset(amount, asset)
  const addr = toAddress.trim()
  if (!(amt > 0)) return { ok: false, error: 'Geçersiz tutar' }
  if (amt < meta.minWithdraw) {
    return { ok: false, error: `Min. çekim ${formatAsset(meta.minWithdraw, asset)}` }
  }
  if (addr.length < 8) return { ok: false, error: 'Geçerli cüzdan adresi gir' }

  const { fee, net } = calcWithdrawFee(asset, amt)
  if (net <= 0) return { ok: false, error: 'Ücret sonrası net tutar 0' }

  const balances = normalizeBalances(profile.balances)
  if (balances[asset] < amt - 1e-12) {
    return { ok: false, error: `Yetersiz ${meta.symbol}` }
  }
  balances[asset] = roundAsset(balances[asset] - amt, asset)

  const request: WithdrawRequest = {
    id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    asset,
    amount: amt,
    fee,
    net,
    toAddress: addr,
    status: 'pending',
    createdAt: Date.now(),
    note: `Çekim kuyruğu −${formatAsset(amt, asset)} (ücret ${formatAsset(fee, asset)}, net ${formatAsset(net, asset)})`,
  }
  saveQueue([request, ...loadWithdrawQueue()].slice(0, MAX_QUEUE))

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

  const balances = normalizeBalances(profile.balances)
  balances[req.asset] = roundAsset(balances[req.asset] + req.amount, req.asset)
  list[idx] = { ...req, status: 'cancelled' }
  saveQueue(list)

  return {
    ok: true,
    request: list[idx]!,
    balances,
    profilePatch: { balances },
  }
}

/** Credit play balance after confirmed on-chain SOL deposit */
export function creditOnChainDeposit(
  profile: PlayerProfile,
  amount: number,
  signature: string,
): WalletResult {
  const res = depositAsset(profile, 'sol', amount, profile.walletAddress ?? undefined)
  if (!res.ok) return res
  // Annotate ledger note via a second deposit-shaped entry is awkward;
  // depositAsset already wrote ledger — rewrite last entry note if matching.
  try {
    const key = 'zincir-drone-ledger-v1'
    const raw = localStorage.getItem(key)
    if (raw) {
      const list = JSON.parse(raw) as Array<Record<string, unknown>>
      if (Array.isArray(list) && list[0] && list[0].kind === 'deposit') {
        list[0].note = `On-chain SOL +${formatAsset(amount, 'sol')} · ${signature.slice(0, 8)}…`
        list[0].address = signature
        localStorage.setItem(key, JSON.stringify(list))
      }
    }
  } catch {
    // ignore
  }
  return res
}
