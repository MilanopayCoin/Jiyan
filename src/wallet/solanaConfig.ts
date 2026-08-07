/** Solana RPC + treasury config for on-chain play deposits. */

export type SolanaCluster = 'devnet' | 'mainnet-beta'

const clusterRaw = (
  import.meta.env.VITE_SOLANA_CLUSTER as string | undefined
)?.trim()

export const SOLANA_CLUSTER: SolanaCluster =
  clusterRaw === 'mainnet-beta' || clusterRaw === 'mainnet'
    ? 'mainnet-beta'
    : 'devnet'

export const SOLANA_RPC =
  (import.meta.env.VITE_SOLANA_RPC as string | undefined)?.trim() ||
  (SOLANA_CLUSTER === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com')

/** Treasury that receives player SOL deposits. Required for on-chain yükle. */
export const SOLANA_TREASURY = (
  import.meta.env.VITE_SOLANA_TREASURY as string | undefined
)?.trim() || ''

export function hasTreasury(): boolean {
  return SOLANA_TREASURY.length >= 32
}

export function explorerTxUrl(signature: string): string {
  const base = 'https://explorer.solana.com/tx/'
  const q = SOLANA_CLUSTER === 'mainnet-beta' ? '' : `?cluster=${SOLANA_CLUSTER}`
  return `${base}${signature}${q}`
}

export function explorerAddressUrl(address: string): string {
  const base = 'https://explorer.solana.com/address/'
  const q = SOLANA_CLUSTER === 'mainnet-beta' ? '' : `?cluster=${SOLANA_CLUSTER}`
  return `${base}${address}${q}`
}

export function shortSig(sig: string): string {
  if (sig.length < 12) return sig
  return `${sig.slice(0, 6)}…${sig.slice(-6)}`
}
