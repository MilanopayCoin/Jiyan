import { useState } from 'react'
import { useAccounts, usePhantom, useSolana } from '@phantom/react-sdk'
import { AddressType } from '@phantom/browser-sdk'
import { depositSolOnChain } from '../wallet/onChainDeposit'
import {
  SOLANA_CLUSTER,
  SOLANA_TREASURY,
  explorerTxUrl,
  hasTreasury,
  shortSig,
} from '../wallet/solanaConfig'
import { formatAsset } from '../game/assets'
import { getOrCreatePilotId } from '../game/friends'

interface Props {
  onCredited: (amount: number, signature: string) => void
}

export function OnChainSolDeposit({ onCredited }: Props) {
  const { isConnected } = usePhantom()
  const { solana, isAvailable } = useSolana()
  const addresses = useAccounts()
  const [amount, setAmount] = useState('0.01')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [lastSig, setLastSig] = useState<string | null>(null)

  const phantomAddr =
    addresses?.find((a) => a.addressType === AddressType.solana)?.address ||
    addresses?.[0]?.address

  const flash = (msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 4000)
  }

  const send = async () => {
    if (!hasTreasury()) {
      flash('Treasury adresi yok — VITE_SOLANA_TREASURY ekle')
      return
    }
    if (!isConnected || !isAvailable || !phantomAddr) {
      flash('Önce Phantom bağla')
      return
    }
    const n = Number(amount.replace(',', '.'))
    if (!(n > 0)) {
      flash('Geçersiz tutar')
      return
    }
    setBusy(true)
    try {
      const memo = `ZD:${getOrCreatePilotId()}`
      const res = await depositSolOnChain(solana, n, memo)
      if (!res.ok) {
        flash(res.error)
        return
      }
      onCredited(res.amount, res.signature)
      setLastSig(res.signature)
      flash(`On-chain yüklendi: ${formatAsset(res.amount, 'sol')}`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'İşlem başarısız')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[#9945ff]/35 bg-[#9945ff]/10 p-4">
      <p className="font-display text-lg text-white">On-chain SOL yükle</p>
      <p className="mt-1 text-xs text-fog">
        Phantom → treasury ({SOLANA_CLUSTER})
        {hasTreasury()
          ? ` · ${SOLANA_TREASURY.slice(0, 4)}…${SOLANA_TREASURY.slice(-4)}`
          : ' · treasury ayarlanmadı'}
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white outline-none focus:border-signal/50"
          placeholder="SOL"
        />
        <button
          type="button"
          disabled={busy || !hasTreasury()}
          onClick={() => void send()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #9945ff)',
          }}
        >
          {busy ? 'İmzala…' : 'Gönder'}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {['0.01', '0.05', '0.1', '0.25'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(v)}
            className="rounded-lg border border-white/15 px-2 py-1 text-xs text-fog"
          >
            {v} SOL
          </button>
        ))}
      </div>

      {hint && <p className="mt-2 text-xs text-signal">{hint}</p>}
      {lastSig && (
        <a
          href={explorerTxUrl(lastSig)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-xs text-ice underline"
        >
          Explorer · {shortSig(lastSig)}
        </a>
      )}
    </div>
  )
}
