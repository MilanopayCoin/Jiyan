import { useState, useCallback, useMemo } from 'react'
import { BADGE_LABELS } from '../../game/storage'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS, scorePoints } from '../../game/vehicles'
import { WalletPanel } from '../WalletPanel'
import {
  computeProfileStats,
  formatPnl,
  formatPilotCode,
  formatWinRate,
} from '../../game/profileStats'
import { formatUsd } from '../../game/stableEconomy'
import { AUTO_CASH_PRESETS } from '../../game/retention'
import {
  rngSeedFromString,
  shortCommit,
  verifyCommit,
  verifyFairness,
} from '../../game/fairness'
import type { FlightResult } from '../../game/types'

interface Props {
  game: GameApi
}

function formatAutoCash(x: number): string {
  return x <= 0 ? 'Kapalı' : `${x}x`
}

export function ProfileScreen({ game }: Props) {
  const { profile } = game
  const craft = CRAFTS[profile.selectedCraft]
  const skin = SKINS[profile.selectedSkin]
  const points = scorePoints(profile.totalCashed)
  const stats = useMemo(() => computeProfileStats(profile), [profile])
  const [notifHint, setNotifHint] = useState<string | null>(null)
  const [shareHint, setShareHint] = useState<string | null>(null)
  const [fairHint, setFairHint] = useState<Record<number, string>>({})

  const onLinked = useCallback(
    (address: string, verified: boolean) => {
      game.linkWallet(address, verified)
    },
    [game],
  )

  const onUnlinked = useCallback(() => {
    game.unlinkWallet()
  }, [game])

  const toggleNotif = async () => {
    if (game.notifOn) {
      game.disableNotifications()
      setNotifHint('Bildirimler kapalı')
    } else {
      const ok = await game.enableNotifications()
      setNotifHint(
        ok
          ? 'Bildirimler açık — seri riski ve görevler'
          : game.notifPermission === 'denied'
            ? 'İzin reddedildi — tarayıcı ayarlarından aç'
            : game.notifPermission === 'unsupported'
              ? 'Bu cihaz bildirim desteklemiyor'
              : 'İzin verilmedi',
      )
    }
    window.setTimeout(() => setNotifHint(null), 2800)
  }

  const onShareInvite = async () => {
    const ok = await game.shareInvite()
    setShareHint(ok ? 'Davet paylaşıldı / kopyalandı' : 'Paylaşım iptal')
    window.setTimeout(() => setShareHint(null), 2200)
  }

  const onCopyPilot = async () => {
    const ok = await game.copyPilotCode()
    setShareHint(ok ? 'Pilot kodu panoda' : 'Kopyalanamadı')
    window.setTimeout(() => setShareHint(null), 2200)
  }

  const verifyFlight = async (h: FlightResult) => {
    const key = h.timestamp
    if (!h.fairSeed || !h.fairCommit) {
      setFairHint((prev) => ({ ...prev, [key]: 'Bu uçuşta kanıt yok' }))
      return
    }
    const commitOk = await verifyCommit(h.fairSeed, h.fairCommit)
    const rolls = h.fairRolls ?? h.layer
    const flags = h.fairCrashFlags
    let replayOk = true
    if (flags && flags.length) {
      replayOk = verifyFairness(
        {
          seed: h.fairSeed,
          commit: h.fairCommit,
          rngSeed: rngSeedFromString(h.fairSeed),
          rolls,
          crashFlags: flags,
        },
        h.craftId,
      )
    }
    const msg =
      commitOk && replayOk
        ? `Doğrulandı · ${shortCommit(h.fairCommit)}`
        : commitOk
          ? 'Commit OK · replay uyuşmaz'
          : 'Commit doğrulanamadı'
    setFairHint((prev) => ({ ...prev, [key]: msg }))
  }

  const checkPreview = game.checkInPreview

  return (
    <div className="relative z-20 flex h-full flex-col overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display text-4xl text-white">Profil</h1>

      {/* Pilot card */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-ice/25 bg-gradient-to-br from-sky-mid/80 via-panel to-ink/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ice">
              Pilot kartı
            </p>
            <p className="mt-1 font-display text-3xl text-white">
              {profile.displayName}
            </p>
            <p className="mt-1 text-sm text-fog">
              {craft.name}
              {skin.rarity !== 'common' ? ` · ${skin.name}` : ''} ·{' '}
              {formatPilotCode(game.pilotId)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-fog">Cüzdan</p>
            <p className="font-display text-2xl text-signal">
              {formatUsd(stats.walletUsd)}
            </p>
            <p className="text-[10px] text-fog">USDC PnL {formatPnl(stats.usdcPnl)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShareInvite}
            className="rounded-full bg-signal/20 px-3 py-1.5 text-xs text-signal"
          >
            Davet paylaş
          </button>
          <button
            type="button"
            onClick={onCopyPilot}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-fog"
          >
            Kod kopyala
          </button>
          <button
            type="button"
            onClick={() => game.setScreen('hangar')}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ice"
          >
            Hangar
          </button>
        </div>
        {shareHint && (
          <p className="mt-2 text-center text-xs text-ice">{shareHint}</p>
        )}
      </section>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-fog">Pilot adı</span>
        <input
          type="text"
          maxLength={16}
          defaultValue={profile.displayName}
          onBlur={(e) => game.rename(e.target.value.trim())}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-signal/50"
        />
      </label>

      <button
        type="button"
        disabled={!game.canCheckInToday}
        onClick={() => game.doCheckIn()}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-signal/35 bg-signal/10 px-4 py-3 text-left backdrop-blur-md disabled:opacity-45"
      >
        <div>
          <p className="text-xs uppercase tracking-wider text-signal">
            Günlük check-in
          </p>
          <p className="mt-0.5 text-sm text-white">
            {game.canCheckInToday
              ? `Gün ${checkPreview.day}: ${checkPreview.label}`
              : `Alındı · seri ${profile.checkInStreak}`}
          </p>
        </div>
        <span className="font-display text-lg text-signal">
          {game.canCheckInToday ? 'AL' : '✓'}
        </span>
      </button>
      {game.retentionHint && (
        <p className="mt-1 text-center text-xs text-signal">{game.retentionHint}</p>
      )}

      <WalletPanel
        linkedAddress={profile.walletAddress}
        verified={profile.walletVerified}
        onLinked={onLinked}
        onUnlinked={onUnlinked}
      />

      <button
        type="button"
        onClick={toggleNotif}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-panel px-4 py-3 text-left backdrop-blur-md"
      >
        <div>
          <p className="text-xs text-fog">Günlük bildirimler</p>
          <p className="text-sm text-white">Seri hatırlatma · görev tamam</p>
        </div>
        <span
          className={`font-display text-lg ${game.notifOn ? 'text-signal' : 'text-fog'}`}
        >
          {game.notifOn ? 'AÇIK' : 'KAPALI'}
        </span>
      </button>
      {notifHint && (
        <p className="mt-1 text-center text-xs text-ice">{notifHint}</p>
      )}

      {/* Play prefs */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-panel px-4 py-3 backdrop-blur-md">
        <p className="text-xs uppercase tracking-wider text-fog">Uçuş tercihleri</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => game.setHighRoller(false)}
            className={`rounded-full px-3 py-1 text-xs ${
              !profile.highRoller
                ? 'bg-signal/25 text-signal'
                : 'border border-white/15 text-fog'
            }`}
          >
            Stable $
          </button>
          <button
            type="button"
            onClick={() => game.setHighRoller(true)}
            className={`rounded-full px-3 py-1 text-xs ${
              profile.highRoller
                ? 'bg-amber/25 text-amber'
                : 'border border-white/15 text-fog'
            }`}
          >
            High roller
          </button>
          <button
            type="button"
            onClick={() => game.setScreen('wallet')}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-ice"
          >
            Cüzdan →
          </button>
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-wider text-fog">
          Auto cash-out · {formatAutoCash(profile.autoCashOut)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {AUTO_CASH_PRESETS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => game.setAutoCashOut(x)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                Math.abs(profile.autoCashOut - x) < 1e-9
                  ? 'bg-ice/25 text-ice'
                  : 'border border-white/15 text-fog'
              }`}
            >
              {x === 0 ? 'Kapalı' : `${x}x`}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { label: 'Rekor', value: stats.bestMultiplier ? fmtX(stats.bestMultiplier) : '—' },
          { label: 'Katman', value: stats.bestLayer ? `K${stats.bestLayer}` : '—' },
          { label: 'İniş oranı', value: formatWinRate(stats.winRate) },
          { label: 'USDC PnL', value: formatPnl(stats.usdcPnl) },
          { label: 'Uçuş serisi', value: String(stats.flightStreak) },
          { label: 'Check-in', value: String(stats.checkInStreak) },
          { label: 'Uçuş', value: String(stats.flights) },
          { label: 'Puan', value: String(points) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-panel px-4 py-3 backdrop-blur-md"
          >
            <p className="text-xs text-fog">{stat.label}</p>
            <p
              className={`font-display text-2xl ${
                stat.label === 'USDC PnL'
                  ? stats.usdcPnl >= 0
                    ? 'text-signal'
                    : 'text-danger'
                  : 'text-white'
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-center text-xs text-fog">
        {stats.safeLandings} iniş · {stats.crashes} düşüş · {stats.craftCount} araç ·{' '}
        {stats.skinCount} skin · {stats.badgeCount} rozet
      </p>

      <h2 className="mt-6 font-display text-2xl text-ice">Rozetler</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {profile.badges.length === 0 && (
          <p className="text-sm text-fog">Henüz rozet yok</p>
        )}
        {profile.badges.map((b) => (
          <span
            key={b}
            className="rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-sm text-amber"
          >
            {BADGE_LABELS[b] ?? b}
          </span>
        ))}
      </div>

      <h2 className="mt-6 font-display text-2xl text-ice">Görevler</h2>
      <ul className="mt-3 space-y-2">
        {profile.missions.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm backdrop-blur-md"
          >
            <div className="flex justify-between gap-2">
              <span className={m.completed ? 'text-signal' : 'text-white'}>
                {m.label}
              </span>
              <span className="text-fog">
                {m.progress}/{m.target}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-signal"
                style={{
                  width: `${Math.min(100, (m.progress / Math.max(1, m.target)) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-display text-2xl text-ice">Son uçuşlar</h2>
      <ul className="mt-3 space-y-2">
        {profile.history.length === 0 && (
          <li className="text-sm text-fog">Henüz uçuş yok</li>
        )}
        {profile.history.slice(0, 10).map((h) => (
          <li
            key={h.timestamp}
            className="rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={h.outcome === 'cashed' ? 'text-signal' : 'text-danger'}
              >
                {CRAFTS[h.craftId ?? 'drone'].name} ·{' '}
                {h.outcome === 'cashed' ? 'İniş' : 'Düşüş'} · K{h.layer}
                {h.usdcPayout != null
                  ? ` · ${h.usdcPayout >= 0 ? '+' : ''}$${Math.abs(h.usdcPayout).toFixed(2)}`
                  : ''}
              </span>
              <span className="font-display text-xl text-white">
                {h.outcome === 'cashed' ? fmtX(h.multiplier) : '0x'}
              </span>
            </div>
            {h.fairCommit && (
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-fog">
                  Fair · {shortCommit(h.fairCommit)}
                </span>
                <button
                  type="button"
                  onClick={() => void verifyFlight(h)}
                  className="shrink-0 text-[10px] uppercase tracking-wider text-ice"
                >
                  Doğrula
                </button>
              </div>
            )}
            {fairHint[h.timestamp] && (
              <p className="mt-1 text-[10px] text-signal">{fairHint[h.timestamp]}</p>
            )}
          </li>
        ))}
      </ul>

      {profile.streak >= 1 && profile.lastFlightDate && (
        <p className="mt-6 text-center text-xs text-amber">
          Filon tehlikede! Bugün uçmazsan {profile.streak} günlük serin
          sıfırlanabilir.
        </p>
      )}
    </div>
  )
}
