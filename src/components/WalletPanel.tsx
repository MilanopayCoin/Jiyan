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

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

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

  const solanaAddr =
    addresses?.find((a) => a.addressType === AddressType.solana)?.address ||
    addresses?.[0]?.address

  useEffect(() => {
    if (isConnected && solanaAddr && solanaAddr !== linkedAddress) {
      onLinked(solanaAddr, false)
    }
  }, [isConnected, solanaAddr, linkedAddress, onLinked])

  const flash = (msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 2800)
  }

  const connectInjected = async () => {
    setBusy(true)
    try {
      if (!isInstalled) {
        window.open('https://phantom.app/download', '_blank', 'noopener')
        flash('Phantom yükle — sonra tekrar bağla')
        return
      }
      const result = await connect({ provider: 'injected' })
      const addr = result.addresses?.[0]?.address
      if (addr) onLinked(addr, false)
      flash('Cüzdan bağlandı')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Bağlantı iptal')
    } finally {
      setBusy(false)
    }
  }

  const connectSocial = async () => {
    setBusy(true)
    try {
      if (hasPhantomAppId()) {
        open()
      } else {
        flash('Sosyal giriş için Phantom Portal appId gerekli')
      }
    } finally {
      setBusy(false)
    }
  }

  const verifyOwnership = async () => {
    if (!isConnected || !solanaAddr || !isAvailable) {
      flash('Önce cüzdanı bağla')
      return
    }
    setBusy(true)
    try {
      const msg = `Zincir: Drone — pilot bağla\nAdres: ${solanaAddr}\nZaman: ${new Date().toISOString()}`
      await solana.signMessage(msg)
      onLinked(solanaAddr, true)
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
      await disconnect()
      onUnlinked()
      flash('Cüzdan bağlantısı kesildi')
    } catch {
      onUnlinked()
    } finally {
      setBusy(false)
    }
  }

  const display = linkedAddress || solanaAddr

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-panel px-4 py-3 backdrop-blur-md">
      <p className="text-xs uppercase tracking-wider text-fog">Phantom cüzdan</p>
      <p className="mt-1 text-sm text-white">
        {display
          ? `${shortAddr(display)}${verified ? ' · doğrulandı' : ' · imza bekleniyor'}`
          : 'Bağlı değil'}
      </p>

      {(isLoading || extLoading) && (
        <p className="mt-2 text-xs text-fog">Phantom kontrol ediliyor…</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!isConnected ? (
          <>
            <button
              type="button"
              disabled={busy || isConnecting}
              onClick={connectInjected}
              className="rounded-xl bg-signal/20 px-3 py-2 text-sm font-medium text-signal disabled:opacity-40"
            >
              {isConnecting || busy ? 'Bağlanıyor…' : 'Phantom bağla'}
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

      {!hasPhantomAppId() && (
        <p className="mt-2 text-[10px] leading-snug text-fog/80">
          Extension ile bağlanır. Google/Apple için{' '}
          <code className="text-fog">VITE_PHANTOM_APP_ID</code> ekleyin
          (phantom.com/portal).
        </p>
      )}
    </div>
  )
}
