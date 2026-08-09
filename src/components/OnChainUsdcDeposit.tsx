import { useState } from 'react'
import { useAccounts, usePhantom, useSolana } from '@phantom/react-sdk'
import { AddressType } from '@phantom/browser-sdk'
import { depositUsdcOnChain, hasGaslessSponsor } from '../wallet/onChainUsdc'
import {
  SOLANA_CLUSTER,
  SOLANA_TREASURY,
  explorerTxUrl,
  hasTreasury,
  shortSig,
} from '../wallet/solanaConfig'
import { formatAsset } from '../game/assets'
import { formatUsd } from '../game/stableEconomy'
import { getOrCreatePilotId } from '../game/friends'

interface Props {
  onCredited: (amount: number, signature: string) => void
}

export function OnChainUsdcDeposit({ onCredited }: Props) {
  const { isConnected } = usePhantom()
  const { solana, isAvailable } = useSolana()
  const addresses = useAccounts()
  const [amount, setAmount] = useState('5')
  const [gasless, setGasless] = useState(hasGaslessSponsor())
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
      const memo = `ZD-USDC:${getOrCreatePilotId()}`
      const res = await depositUsdcOnChain(solana, n, memo, {
        gasless: gasless && hasGaslessSponsor(),
      })
      if (!res.ok) {
        flash(res.error)
        return
      }
      onCredited(res.amount, res.signature)
      setLastSig(res.signature)
      flash(
        `On-chain yüklendi: ${formatUsd(res.amount)}${res.gasless ? ' · gasless' : ''}`,
      )
    } catch (err) {
      flash(err instanceof Error ? err.message : 'İşlem başarısız')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[#2775ca]/40 bg-[#2775ca]/10 p-4">
      <p className="font-display text-lg text-white">On-chain USDC yükle</p>
      <p className="mt-1 text-xs text-fog">
        Phantom SPL → treasury ({SOLANA_CLUSTER})
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
          placeholder="USDC"
        />
        <button
          type="button"
          disabled={busy || !hasTreasury()}
          onClick={() => void send()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #1d4ed8, #2775ca)' }}
        >
          {busy ? 'İmzala…' : 'Gönder'}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {['1', '5', '10', '25'].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(v)}
            className="rounded-lg border border-white/15 px-2 py-1 text-xs text-fog"
          >
            ${v}
          </button>
        ))}
      </div>

      {hasGaslessSponsor() && (
        <label className="mt-3 flex items-center justify-between text-sm text-white">
          <span>
            Gasless (sponsor fee)
            <span className="mt-0.5 block text-[11px] text-fog">
              SOL gerekmez — /api/sponsor imzalar
            </span>
          </span>
          <input
            type="checkbox"
            checked={gasless}
            onChange={(e) => setGasless(e.target.checked)}
            className="h-5 w-5 accent-[#2775ca]"
          />
        </label>
      )}

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
      <p className="mt-2 text-[11px] text-fog">
        Play bakiyesine {formatAsset(Number(amount) || 0, 'usdc')} yazılır
      </p>
    </div>
  )
}
