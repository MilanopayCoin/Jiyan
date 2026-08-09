/** Provably-fair flight seeds + USDC receipt helpers */

import { createRng, hashSeed } from './challenge'
import { rollCrash } from './math'
import type { AssetId } from './assets'
import type { CraftId, FlightResult, Outcome } from './types'
import { formatUsd, isStableAsset, toUsdcAmount } from './stableEconomy'
import { roundAsset } from './assets'

export interface FairnessProof {
  /** Revealed seed (after flight) */
  seed: string
  /** Commitment shown/stored at takeoff — sha256(seed) hex */
  commit: string
  /** Numeric RNG seed derived from seed string */
  rngSeed: number
  /** How many climb rolls were drawn (layer attempts) */
  rolls: number
  /** Crash outcome per attempted layer (1..rolls) before shields */
  crashFlags: boolean[]
}

export function makeFlightSeed(extra = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? [...crypto.getRandomValues(new Uint8Array(8))]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : Math.random().toString(36).slice(2, 10)
  return `zd-${Date.now().toString(36)}-${rand}${extra ? `-${extra}` : ''}`
}

export function rngSeedFromString(seed: string): number {
  return hashSeed(seed)
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(input),
    )
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Fallback (non-crypto) for odd environments
  return hashSeed(input).toString(16).padStart(8, '0').repeat(8).slice(0, 64)
}

export function shortCommit(commit: string): string {
  if (commit.length < 12) return commit
  return `${commit.slice(0, 8)}…${commit.slice(-6)}`
}

/** Replay crash rolls for verification UI */
export function replayCrashFlags(
  seed: string,
  craftId: CraftId,
  rolls: number,
): boolean[] {
  const rng = createRng(rngSeedFromString(seed))
  const flags: boolean[] = []
  for (let layer = 1; layer <= rolls; layer++) {
    flags.push(rollCrash(layer, craftId, false, rng))
  }
  return flags
}

export function verifyFairness(proof: FairnessProof, craftId: CraftId): boolean {
  if (!proof.seed || proof.rolls < 0) return false
  if (proof.rngSeed !== rngSeedFromString(proof.seed)) return false
  const replayed = replayCrashFlags(proof.seed, craftId, proof.rolls)
  if (replayed.length !== proof.crashFlags.length) return false
  return replayed.every((f, i) => f === proof.crashFlags[i])
}

export async function verifyCommit(seed: string, commit: string): Promise<boolean> {
  if (!seed || !commit) return false
  const h = await sha256Hex(seed)
  return h === commit
}

export async function buildProof(
  seed: string,
  craftId: CraftId,
  rolls: number,
): Promise<FairnessProof> {
  const commit = await sha256Hex(seed)
  return {
    seed,
    commit,
    rngSeed: rngSeedFromString(seed),
    rolls,
    crashFlags: replayCrashFlags(seed, craftId, rolls),
  }
}

/** Always express stake/payout in USDC ($) terms for UI */
export function stakeAsUsdc(
  amount: number | undefined,
  asset: AssetId | undefined,
): number {
  if (amount == null || !asset) return 0
  return toUsdcAmount(amount, asset)
}

export function formatStakeUsdc(
  amount: number | undefined,
  asset: AssetId | undefined,
): string {
  const u = stakeAsUsdc(amount, asset)
  if (!asset) return formatUsd(0)
  if (isStableAsset(asset)) return `${formatUsd(u)} USDC`
  return `${formatUsd(u)} USDC`
}

export function formatPayoutUsdc(result: FlightResult): string {
  if (!result.stakeAsset || result.stakeAmount == null) return ''
  if (result.outcome === 'crashed') {
    return `−${formatStakeUsdc(result.stakeAmount, result.stakeAsset)}`
  }
  const payout =
    result.payoutAmount ??
    roundAsset(result.stakeAmount * result.multiplier, result.stakeAsset)
  const usdc = toUsdcAmount(payout, result.stakeAsset)
  return `+${formatUsd(usdc)} USDC`
}

export function receiptLine(result: FlightResult): string {
  if (!result.stakeAsset || result.stakeAmount == null) {
    return result.outcome === 'cashed'
      ? `İniş ${result.multiplier.toFixed(2)}x · pil`
      : `Çöküş · pil`
  }
  return result.outcome === 'cashed'
    ? `${formatPayoutUsdc(result)} @ ${result.multiplier.toFixed(2)}x`
    : formatPayoutUsdc(result)
}

export function ledgerDeepLink(entryId?: string): string {
  const base =
    typeof location !== 'undefined'
      ? `${location.origin}${location.pathname}`
      : 'https://chaindrone.netlify.app/'
  return entryId ? `${base}#ledger-${entryId}` : `${base}?screen=wallet`
}

export type ReceiptKind = Outcome
