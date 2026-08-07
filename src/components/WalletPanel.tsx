import { useEffect, useState } from 'react'
import {
  useConnect,
  useDisconnect,
  usePhantom,
  useAccounts,
  useSolana,
  useIsExtensionInstalled,
  useModal,
} from '@phantom/react-sdk'
import { AddressType } from '@phantom/browser-sdk'
import { hasPhantomAppId } from '../wallet/PhantomRoot'
import {
  connectWalletConnect,
  disconnectWalletConnect,
  hasWalletConnectProjectId,
  signWithWalletConnect,
  walletConnectAddress,
} from '../wallet/walletConnect'

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

type Source = 'phantom' | 'walletconnect' | null

interface Props {
  linkedAddress: string | null
  verified: boolean
  onLinked: (address: string, verified: boolean) => void
  onUnlinked: () => void
}

export function WalletPanel({
  linkedAddress,
  verified,
  onLinked,
  onUnlinked,
}: Props) {
  const { connect, isConnecting, error } = useConnect()
  const { disconnect, isDisconnecting } = useDisconnect()
  const { isConnected, isLoading } = usePhantom()
  const addresses = useAccounts()
  const { solana, isAvailable } = useSolana()
  const { isInstalled, isLoading: extLoading } = useIsExtensionInstalled()
  const { open } = useModal()
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<Source>(null)

  const phantomAddr =
    addresses?.find((a) => a.addressType === AddressType.solana)?.address ||
    addresses?.[0]?.address

  const wcAddr = walletConnectAddress()
  const liveAddr = phantomAddr || wcAddr
  const connected = Boolean(isConnected || wcAddr)

  useEffect(() => {
    if (isConnected && phantomAddr) {
      setSource('phantom')
      if (phantomAddr !== linkedAddress) onLinked(phantomAddr, false)
    }
  }, [isConnected, phantomAddr, linkedAddress, onLinked])

  const flash = (msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 3200)
  }

  const connectPhantom = async () => {
    setBusy(true)
    try {
      if (wcAddr) await disconnectWalletConnect()
      if (!isInstalled) {
        window.open('https://phantom.app/download', '_blank', 'noopener')
        flash('Phantom yükle — sonra tekrar bağla')
        return
      }
      const result = await connect({ provider: 'injected' })
      const addr = result.addresses?.[0]?.address
      if (addr) {
        setSource('phantom')
        onLinked(addr, false)
      }
      flash('Phantom bağlandı')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Bağlantı iptal')
    } finally {
      setBusy(false)
    }
  }

  const connectWc = async () => {
    if (!hasWalletConnectProjectId()) {
      flash('WalletConnect için VITE_WALLETCONNECT_PROJECT_ID gerekli')
      return
    }
    setBusy(true)
    try {
      if (isConnected) {
        try {
          await disconnect()
        } catch {
          // ignore
        }
      }
      const addr = await connectWalletConnect()
      setSource('walletconnect')
      onLinked(addr, false)
      flash('WalletConnect bağlandı')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'WalletConnect iptal')
    } finally {
      setBusy(false)
    }
  }

  const connectSocial = async () => {
    setBusy(true)
    try {
      if (hasPhantomAppId()) open()
      else flash('Sosyal giriş için VITE_PHANTOM_APP_ID gerekli')
    } finally {
      setBusy(false)
    }
  }

  const verifyOwnership = async () => {
    const addr = liveAddr || linkedAddress
    if (!addr) {
      flash('Önce cüzdanı bağla')
      return
    }
    setBusy(true)
    try {
      const msg = `Zincir: Drone — pilot bağla\nAdres: ${addr}\nZaman: ${new Date().toISOString()}`
      if (source === 'walletconnect' || (!isConnected && wcAddr)) {
        await signWithWalletConnect(msg)
      } else if (isAvailable && isConnected) {
        await solana.signMessage(msg)
      } else {
        flash('İmza için aktif oturum yok — yeniden bağla')
        return
      }
      onLinked(addr, true)
      flash('İmza doğrulandı · cüzdan kayıtlı')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'İmza iptal')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    try {
      if (isConnected) await disconnect()
      await disconnectWalletConnect()
      setSource(null)
      onUnlinked()
      flash('Cüzdan bağlantısı kesildi')
    } catch {
      setSource(null)
      onUnlinked()
    } finally {
      setBusy(false)
    }
  }

  const display = linkedAddress || liveAddr

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-panel px-4 py-3 backdrop-blur-md">
      <p className="text-xs uppercase tracking-wider text-fog">Wallet Connect</p>
      <p className="mt-1 text-sm text-white">
        {display
          ? `${shortAddr(display)}${verified ? ' · doğrulandı' : ' · imza bekleniyor'}${
              source === 'walletconnect'
                ? ' · WC'
                : source === 'phantom'
                  ? ' · Phantom'
                  : ''
            }`
          : 'Bağlı değil'}
      </p>

      {(isLoading || extLoading) && (
        <p className="mt-2 text-xs text-fog">Cüzdan kontrol ediliyor…</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!connected ? (
          <>
            <button
              type="button"
              disabled={busy || isConnecting}
              onClick={connectPhantom}
              className="rounded-xl bg-signal/20 px-3 py-2 text-sm font-medium text-signal disabled:opacity-40"
            >
              {isConnecting || busy ? 'Bağlanıyor…' : 'Connect Wallet'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={connectWc}
              className="rounded-xl border border-[#3b99fc]/50 bg-[#3b99fc]/15 px-3 py-2 text-sm font-medium text-[#7eb8ff] disabled:opacity-40"
            >
              WalletConnect
            </button>
            {hasPhantomAppId() && (
              <button
                type="button"
                disabled={busy}
                onClick={connectSocial}
                className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white"
              >
                Google / Apple
              </button>
            )}
            {!isInstalled && !extLoading && (
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-ice/30 px-3 py-2 text-sm text-ice"
              >
                Phantom yükle
              </a>
            )}
          </>
        ) : (
          <>
            {!verified && (
              <button
                type="button"
                disabled={busy}
                onClick={verifyOwnership}
                className="rounded-xl bg-amber/20 px-3 py-2 text-sm font-medium text-amber disabled:opacity-40"
              >
                Mesaj imzala
              </button>
            )}
            <button
              type="button"
              disabled={busy || isDisconnecting}
              onClick={handleDisconnect}
              className="rounded-xl border border-white/15 px-3 py-2 text-sm text-fog"
            >
              Ayır
            </button>
          </>
        )}
      </div>

      {(hint || error) && (
        <p className="mt-2 text-xs text-ice">
          {hint || (error instanceof Error ? error.message : String(error))}
        </p>
      )}

      <p className="mt-2 text-[10px] leading-snug text-fog/80">
        Connect Wallet = Phantom extension. WalletConnect = QR / mobil cüzdan
        {!hasWalletConnectProjectId() && (
          <>
            {' '}
            · WC için <code className="text-fog">VITE_WALLETCONNECT_PROJECT_ID</code>{' '}
            (cloud.reown.com)
          </>
        )}
      </p>
    </div>
  )
}
