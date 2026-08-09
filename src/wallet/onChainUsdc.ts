import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type { ISolanaChain } from '@phantom/react-sdk'
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from '@solana/spl-token'
import {
  SOLANA_RPC,
  SOLANA_TREASURY,
  hasTreasury,
  explorerTxUrl,
  SOLANA_CLUSTER,
} from './solanaConfig'

/** Circle USDC mints */
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
export const USDC_DECIMALS = 6

export function usdcMint(): PublicKey {
  const override = (import.meta.env.VITE_USDC_MINT as string | undefined)?.trim()
  if (override) return new PublicKey(override)
  return new PublicKey(
    SOLANA_CLUSTER === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET,
  )
}

export function sponsorPubkey(): PublicKey | null {
  const raw = (import.meta.env.VITE_SOLANA_SPONSOR_PUBKEY as string | undefined)?.trim()
  if (!raw || raw.length < 32) return null
  try {
    return new PublicKey(raw)
  } catch {
    return null
  }
}

export function hasGaslessSponsor(): boolean {
  return Boolean(sponsorPubkey())
}

export type OnChainUsdcResult =
  | { ok: true; signature: string; amount: number; explorerUrl: string; gasless: boolean }
  | { ok: false; error: string }

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
)

async function callSponsorPresign(txBase64Url: string): Promise<{
  transaction: string
  txId?: string
}> {
  const base = (import.meta.env.VITE_SYNC_API as string | undefined) || '/api'
  const res = await fetch(`${base}/sponsor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: txBase64Url }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Sponsor API ${res.status}`)
  }
  return (await res.json()) as { transaction: string; txId?: string }
}

/** Transfer SPL USDC to treasury; optional gasless fee payer via /api/sponsor */
export async function depositUsdcOnChain(
  solana: ISolanaChain,
  amountUsdc: number,
  memo?: string,
  opts?: { gasless?: boolean },
): Promise<OnChainUsdcResult> {
  if (!hasTreasury()) {
    return { ok: false, error: 'Treasury yok — VITE_SOLANA_TREASURY ayarla' }
  }
  if (!(amountUsdc > 0) || !Number.isFinite(amountUsdc)) {
    return { ok: false, error: 'Geçersiz USDC tutarı' }
  }
  if (amountUsdc < 1) {
    return { ok: false, error: 'Min. on-chain yükleme 1 USDC' }
  }
  if (amountUsdc > 10_000) {
    return { ok: false, error: 'Maks. on-chain yükleme 10,000 USDC' }
  }

  const wantGasless = Boolean(opts?.gasless)
  const sponsor = wantGasless ? sponsorPubkey() : null
  if (wantGasless && !sponsor) {
    return {
      ok: false,
      error: 'Gasless için VITE_SOLANA_SPONSOR_PUBKEY + /api/sponsor gerekli',
    }
  }

  try {
    const fromStr = solana.publicKey
    if (!fromStr) {
      return { ok: false, error: 'Phantom public key yok — yeniden bağla' }
    }

    const connection = new Connection(SOLANA_RPC, 'confirmed')
    const from = new PublicKey(fromStr)
    const treasury = new PublicKey(SOLANA_TREASURY)
    const mint = usdcMint()
    const rawAmount = Math.round(amountUsdc * 10 ** USDC_DECIMALS)
    if (rawAmount <= 0) return { ok: false, error: 'Tutar çok küçük' }

    const fromAta = await getAssociatedTokenAddress(mint, from)
    const toAta = await getAssociatedTokenAddress(mint, treasury)
    const feePayer = sponsor ?? from

    const instructions: TransactionInstruction[] = []
    try {
      await getAccount(connection, toAta)
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(feePayer, toAta, treasury, mint),
      )
    }

    instructions.push(
      createTransferInstruction(fromAta, toAta, from, rawAmount),
    )

    if (memo && memo.length > 0) {
      instructions.push(
        new TransactionInstruction({
          keys: [{ pubkey: from, isSigner: true, isWritable: false }],
          programId: MEMO_PROGRAM_ID,
          data: new TextEncoder().encode(memo.slice(0, 100)) as unknown as Buffer,
        }),
      )
    }

    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    const message = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message()
    const transaction = new VersionedTransaction(message)

    const result = await solana.signAndSendTransaction(
      transaction as unknown as Parameters<ISolanaChain['signAndSendTransaction']>[0],
      sponsor
        ? {
            presignTransaction: async (tx: string) => {
              const signed = await callSponsorPresign(tx)
              return signed.transaction
            },
          }
        : undefined,
    )

    const signature = result.signature
    if (!signature) {
      return { ok: false, error: 'İmza alındı ama tx hash yok' }
    }

    return {
      ok: true,
      signature,
      amount: amountUsdc,
      explorerUrl: explorerTxUrl(signature),
      gasless: Boolean(sponsor),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'İşlem iptal / başarısız'
    if (/User rejected|cancelled|denied/i.test(msg)) {
      return { ok: false, error: 'İmza iptal edildi' }
    }
    return { ok: false, error: msg }
  }
}
