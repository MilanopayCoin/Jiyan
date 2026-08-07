import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { GameApi } from '../../game/useGame'
import {
  ASSET_ORDER,
  ASSETS,
  LEDGER_LABELS,
  formatAsset,
  type AssetId,
} from '../../game/assets'
import { loadLedger } from '../../game/walletOps'
import {
  calcWithdrawFee,
  loadWithdrawQueue,
  WITHDRAW_FEE_BPS,
} from '../../game/withdrawQueue'
import { WalletPanel } from '../WalletPanel'
import { OnChainSolDeposit } from '../OnChainSolDeposit'

interface Props {
  game: GameApi
}

type Tab = 'balances' | 'deposit' | 'withdraw'

export function WalletScreen({ game }: Props) {
  const { profile } = game
  const [tab, setTab] = useState<Tab>('balances')
  const [asset, setAsset] = useState<AssetId>(profile.payAsset)
  const [amount, setAmount] = useState('')
  const [toAddress, setToAddress] = useState(profile.walletAddress ?? '')
  const [hint, setHint] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const ledger = useMemo(() => loadLedger(), [tick, profile.balances])
  const queue = useMemo(() => loadWithdrawQueue(), [tick, profile.balances])
  const meta = ASSETS[asset]
  const bal = profile.balances?.[asset] ?? 0
  const amtNum = Number(amount.replace(',', '.')) || 0
  const feePreview =
    tab === 'withdraw' && amtNum > 0 ? calcWithdrawFee(asset, amtNum) : null

  const flash = (msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 2800)
  }

  const refresh = () => setTick((n) => n + 1)

  const onDeposit = () => {
    const n = Number(amount.replace(',', '.'))
    const res = game.deposit(asset, n)
    if (!res.ok) {
      flash(res.error)
      return
    }
    setAmount('')
    refresh()
    flash(`Demo yüklendi: ${formatAsset(n, asset)}`)
  }

  const onWithdraw = () => {
    const n = Number(amount.replace(',', '.'))
    const res = game.withdraw(asset, n, toAddress || profile.walletAddress || '')
    if (!res.ok) {
      flash(res.error)
      return
    }
    setAmount('')
    refresh()
    if (res.ok && 'request' in res) {
      flash(
        `Kuyruğa alındı · net ${formatAsset(res.request.net, asset)} (ücret ${formatAsset(res.request.fee, asset)})`,
      )
    }
  }

  const onDemo = () => {
    const res = game.claimDemo()
    if (!res.ok) {
      flash(res.error)
      return
    }
    refresh()
    flash('Demo paket alındı — oynamaya başla')
  }

  return (
    <div className="relative z-20 flex h-full flex-col overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display text-4xl text-white">Cüzdan</h1>
      <p className="mt-1 text-sm text-fog">
        USDT · USDC · SOL · ETH · BTC — yükle, oyna, çek
      </p>

      {!profile.demoPackClaimed && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onDemo}
          className="mt-4 w-full rounded-2xl border border-signal/40 bg-signal/15 px-4 py-3 text-left"
        >
          <p className="font-display text-lg text-signal">Demo paket al</p>
          <p className="text-xs text-fog">
            25 USDT · 25 USDC · 0.5 SOL · 0.02 ETH · 0.001 BTC
          </p>
        </motion.button>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2">
        {ASSET_ORDER.map((id) => {
          const a = ASSETS[id]
          const active = profile.payAsset === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setAsset(id)
                game.setPayAsset(id)
              }}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left backdrop-blur-md ${
                active
                  ? 'border-signal/50 bg-signal/10'
                  : 'border-white/10 bg-panel'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full font-display text-sm text-ink"
                  style={{ background: a.color }}
                >
                  {a.symbol.slice(0, 1)}
                </span>
                <div>
                  <p className="font-medium text-white">
                    {a.symbol}
                    {active ? ' · oyun' : ''}
                  </p>
                  <p className="text-xs text-fog">{a.chainLabel}</p>
                </div>
              </div>
              <p className="font-display text-lg text-white">
                {formatAsset(profile.balances?.[id] ?? 0, id).replace(
                  ` ${a.symbol}`,
                  '',
                )}
              </p>
            </button>
          )
        })}
      </div>

      <label className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-panel px-4 py-3">
        <div>
          <p className="text-sm text-white">Kripto ile oyna</p>
          <p className="text-xs text-fog">Kapalıysa ücretsiz pil kullanılır</p>
        </div>
        <input
          type="checkbox"
          checked={profile.payWithCrypto}
          onChange={(e) => game.setPayWithCrypto(e.target.checked)}
          className="h-5 w-5 accent-[#3dffa8]"
        />
      </label>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wider text-fog">
          Bahis ({ASSETS[profile.payAsset].symbol})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ASSETS[profile.payAsset].stakes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => game.setStakeAmount(s)}
              className={`rounded-xl px-3 py-2 text-sm ${
                Math.abs(profile.stakeAmount - s) < 1e-12
                  ? 'bg-signal/25 text-signal'
                  : 'border border-white/15 text-white'
              }`}
            >
              {formatAsset(s, profile.payAsset)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {(
          [
            ['balances', 'İşlem'],
            ['deposit', 'Yükle'],
            ['withdraw', 'Çek'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              tab === id
                ? 'bg-white/15 text-white'
                : 'border border-white/10 text-fog'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'deposit' && (
        <OnChainSolDeposit
          onCredited={(solAmt, signature) => {
            const res = game.creditChainDeposit(solAmt, signature)
            if (!res.ok) {
              flash(res.error)
              return
            }
            refresh()
            flash(`Bakiyeye eklendi: ${formatAsset(solAmt, 'sol')}`)
          }}
        />
      )}

      {(tab === 'deposit' || tab === 'withdraw') && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-panel p-4 backdrop-blur-md">
          <p className="text-xs text-fog">
            {tab === 'deposit' ? 'Demo yükleme (anında)' : 'Çekim kuyruğu'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ASSET_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAsset(id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  asset === id ? 'text-ink' : 'border border-white/15 text-fog'
                }`}
                style={
                  asset === id ? { background: ASSETS[id].color } : undefined
                }
              >
                {ASSETS[id].symbol}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-fog">
            Bakiye: {formatAsset(bal, asset)} · {meta.chainLabel}
          </p>
          <input
            type="text"
            inputMode="decimal"
            placeholder={`Tutar (${meta.symbol})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-signal/50"
          />
          {tab === 'withdraw' && (
            <>
              <input
                type="text"
                placeholder="Çekim adresi"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-signal/50"
              />
              {feePreview && (
                <div className="mt-2 rounded-xl border border-amber/25 bg-amber/10 px-3 py-2 text-xs text-amber">
                  Ücret %{WITHDRAW_FEE_BPS / 100}:{' '}
                  {formatAsset(feePreview.fee, asset)} → net{' '}
                  {formatAsset(feePreview.net, asset)}
                </div>
              )}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {(tab === 'deposit'
              ? [meta.minDeposit, meta.flightStake * 10, meta.flightStake * 25]
              : [meta.minWithdraw, bal / 2, bal]
            )
              .filter((n) => n > 0)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(roundHint(n, meta.decimals)))}
                  className="rounded-lg border border-white/15 px-2 py-1 text-xs text-fog"
                >
                  {formatAsset(n, asset)}
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={tab === 'deposit' ? onDeposit : onWithdraw}
            className="mt-3 w-full rounded-xl py-3 font-semibold text-ink"
            style={{
              background:
                tab === 'deposit'
                  ? 'linear-gradient(135deg, #1a8f5c, #3dffa8)'
                  : 'linear-gradient(135deg, #b45309, #ffb84d)',
            }}
          >
            {tab === 'deposit' ? 'Demo yükle' : 'Kuyruğa al'}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-fog">
            {tab === 'deposit'
              ? 'Demo anında eklenir. Gerçek SOL için yukarıdaki Phantom yüklemeyi kullan.'
              : 'Bakiye düşer, talep bekleyen kuyruğa girer. Ücret şeffaf; iptal iade eder.'}
          </p>
        </div>
      )}

      {tab === 'withdraw' && queue.some((q) => q.status === 'pending') && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-fog">
            Bekleyen çekimler
          </p>
          <ul className="mt-2 space-y-2">
            {queue
              .filter((q) => q.status === 'pending')
              .slice(0, 8)
              .map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-panel px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm text-white">
                      {formatAsset(q.net, q.asset)} net
                    </p>
                    <p className="text-[11px] text-fog">
                      Ücret {formatAsset(q.fee, q.asset)} ·{' '}
                      {q.toAddress.slice(0, 6)}…{q.toAddress.slice(-4)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const res = game.cancelQueuedWithdraw(q.id)
                      if (!res.ok) flash(res.error)
                      else {
                        refresh()
                        flash('Çekim iptal · bakiye iade')
                      }
                    }}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-fog"
                  >
                    İptal
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {tab === 'balances' && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-fog">Son işlemler</p>
          <ul className="mt-2 space-y-2">
            {ledger.length === 0 && (
              <li className="rounded-xl border border-white/10 bg-panel px-3 py-3 text-sm text-fog">
                Henüz işlem yok
              </li>
            )}
            {ledger.slice(0, 12).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-panel px-3 py-2.5"
              >
                <div>
                  <p className="text-sm text-white">{LEDGER_LABELS[e.kind]}</p>
                  <p className="text-[11px] text-fog">{e.note}</p>
                </div>
                <p
                  className={`font-display text-sm ${
                    e.amount >= 0 ? 'text-signal' : 'text-danger'
                  }`}
                >
                  {e.amount >= 0 ? '+' : ''}
                  {formatAsset(Math.abs(e.amount), e.asset)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <WalletPanel
          linkedAddress={profile.walletAddress}
          verified={profile.walletVerified}
          onLinked={(addr, verified) => game.linkWallet(addr, verified)}
          onUnlinked={() => game.unlinkWallet()}
        />
      </div>

      {hint && (
        <p className="mt-3 text-center text-sm text-signal">{hint}</p>
      )}
    </div>
  )
}

function roundHint(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}
