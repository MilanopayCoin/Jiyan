import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js'
import type { ISolanaChain } from '@phantom/react-sdk'
import {
  SOLANA_RPC,
  SOLANA_TREASURY,
  hasTreasury,
  explorerTxUrl,
} from './solanaConfig'

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
)

export type OnChainDepositResult =
  | { ok: true; signature: string; amount: number; explorerUrl: string }
  | { ok: false; error: string }

/** Build + send native SOL to game treasury via Phantom. */
export async function depositSolOnChain(
  solana: ISolanaChain,
  amountSol: number,
  memo?: string,
): Promise<OnChainDepositResult> {
  if (!hasTreasury()) {
    return {
      ok: false,
      error: 'Treasury yok — VITE_SOLANA_TREASURY ayarla',
    }
  }
  if (!(amountSol > 0) || !Number.isFinite(amountSol)) {
    return { ok: false, error: 'Geçersiz SOL tutarı' }
  }
  if (amountSol < 0.01) {
    return { ok: false, error: 'Min. on-chain yükleme 0.01 SOL' }
  }
  if (amountSol > 50) {
    return { ok: false, error: 'Maks. on-chain yükleme 50 SOL' }
  }

  try {
    const fromStr = solana.publicKey
    if (!fromStr) {
      return { ok: false, error: 'Phantom public key yok — yeniden bağla' }
    }

    const connection = new Connection(SOLANA_RPC, 'confirmed')
    const from = new PublicKey(fromStr)
    const to = new PublicKey(SOLANA_TREASURY)
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)
    if (lamports <= 0) return { ok: false, error: 'Tutar çok küçük' }

    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    const instructions: TransactionInstruction[] = [
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports,
      }),
    ]
    if (memo && memo.length > 0) {
      instructions.push(
        new TransactionInstruction({
          keys: [{ pubkey: from, isSigner: true, isWritable: false }],
          programId: MEMO_PROGRAM_ID,
          data: new TextEncoder().encode(memo.slice(0, 100)) as unknown as Buffer,
        }),
      )
    }

    const message = new TransactionMessage({
      payerKey: from,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message()

    const transaction = new VersionedTransaction(message)
    // Phantom SDK types VersionedTransaction from a shared package; cast at boundary
    const result = await solana.signAndSendTransaction(
      transaction as unknown as Parameters<ISolanaChain['signAndSendTransaction']>[0],
    )
    const signature = result.signature
    if (!signature) {
      return { ok: false, error: 'İmza alındı ama tx hash yok' }
    }

    return {
      ok: true,
      signature,
      amount: amountSol,
      explorerUrl: explorerTxUrl(signature),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'İşlem iptal / başarısız'
    if (/User rejected|cancelled|denied/i.test(msg)) {
      return { ok: false, error: 'İmza iptal edildi' }
    }
    return { ok: false, error: msg }
  }
}
