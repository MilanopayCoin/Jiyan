import type { Context } from '@netlify/functions'
import { Keypair, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Fee-payer sponsor for gasless USDC deposits.
 * Env: SPONSOR_PRIVATE_KEY = base58 secret key (server-only, never VITE_*)
 */
export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: cors })
  }

  const secret = process.env.SPONSOR_PRIVATE_KEY?.trim()
  if (!secret) {
    return Response.json(
      { error: 'SPONSOR_PRIVATE_KEY not configured' },
      { status: 503, headers: cors },
    )
  }

  try {
    const body = (await req.json()) as { transaction?: string }
    if (!body.transaction || typeof body.transaction !== 'string') {
      return Response.json(
        { error: 'transaction (base64url) required' },
        { status: 400, headers: cors },
      )
    }

    const sponsor = Keypair.fromSecretKey(bs58.decode(secret))
    const txBytes = Buffer.from(body.transaction, 'base64url')
    const tx = VersionedTransaction.deserialize(txBytes)
    tx.sign([sponsor])

    const txId = bs58.encode(tx.signatures[0]!)
    return Response.json(
      {
        transaction: Buffer.from(tx.serialize()).toString('base64url'),
        txId,
        feePayer: sponsor.publicKey.toBase58(),
      },
      { headers: cors },
    )
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'sponsor failed' },
      { status: 500, headers: cors },
    )
  }
}
