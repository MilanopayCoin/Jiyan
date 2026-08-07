import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletConnectWalletAdapter } from '@walletconnect/solana-adapter'

const projectId = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
)?.trim()

let adapter: WalletConnectWalletAdapter | null = null

export function hasWalletConnectProjectId(): boolean {
  return Boolean(projectId)
}

export function getWalletConnectProjectId(): string | null {
  return projectId || null
}

export function getWalletConnectAdapter(): WalletConnectWalletAdapter | null {
  if (!projectId) return null
  if (typeof window === 'undefined') return null
  if (!adapter) {
    adapter = new WalletConnectWalletAdapter({
      network: WalletAdapterNetwork.Mainnet,
      options: {
        projectId,
        metadata: {
          name: 'Zincir: Drone',
          description: 'AR risk-ödül yükseliş oyunu',
          url:
            typeof location !== 'undefined'
              ? location.origin
              : 'https://chaindrone.netlify.app',
          icons: [
            typeof location !== 'undefined'
              ? `${location.origin}/favicon.svg`
              : 'https://chaindrone.netlify.app/favicon.svg',
          ],
        },
      },
    })
  }
  return adapter
}

export async function connectWalletConnect(): Promise<string> {
  const wc = getWalletConnectAdapter()
  if (!wc) {
    throw new Error(
      'WalletConnect Project ID yok — VITE_WALLETCONNECT_PROJECT_ID ekle (cloud.reown.com)',
    )
  }
  if (!wc.connected) {
    await wc.connect()
  }
  const key = wc.publicKey?.toBase58()
  if (!key) throw new Error('WalletConnect adres alınamadı')
  return key
}

export async function disconnectWalletConnect(): Promise<void> {
  const wc = getWalletConnectAdapter()
  if (wc?.connected) {
    await wc.disconnect()
  }
}

export async function signWithWalletConnect(message: string): Promise<void> {
  const wc = getWalletConnectAdapter()
  if (!wc?.connected || !wc.publicKey) {
    throw new Error('WalletConnect bağlı değil')
  }
  const encoded = new TextEncoder().encode(message)
  await wc.signMessage(encoded)
}

export function walletConnectAddress(): string | null {
  const wc = getWalletConnectAdapter()
  return wc?.connected ? wc.publicKey?.toBase58() ?? null : null
}
