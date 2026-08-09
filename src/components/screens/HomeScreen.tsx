import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS } from '../../game/vehicles'
import type { CraftId } from '../../game/types'
import { InstallBanner } from '../InstallBanner'
import { ASSETS, formatAsset, normalizeBalances } from '../../game/assets'
import { canStakeCrypto } from '../../game/walletOps'
import { AUTO_CASH_PRESETS, formatAutoCash } from '../../game/retention'
import {
  formatUsd,
  stakePresets,
  totalUsdBalance,
} from '../../game/stableEconomy'

interface Props {
  game: GameApi
}

const ICONS: Record<CraftId, string> = {
  drone: '◈',
  plane: '✈',
  rocket: '▲',
  balloon: '○',
  kite: '◇',
  ufo: '◎',
  paper: '△',
}

export function HomeScreen({ game }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const mission =
    game.profile.missions.find((m) => !m.completed) ?? game.profile.missions[0]
  const payAsset = game.profile.payAsset
  const stakeAmt =
    game.profile.stakeAmount ||
    (game.profile.highRoller ? ASSETS[payAsset].flightStake : 1)
  const cryptoOk = canStakeCrypto(game.profile, payAsset, stakeAmt)
  const starsOk = game.profile.starsBalance >= game.starsFlightCost
  const noCredits = !cryptoOk && !starsOk && game.profile.flightCredits <= 0
  const craft = CRAFTS[game.profile.selectedCraft]
  const skin = SKINS[game.profile.selectedSkin]
  const bal = normalizeBalances(game.profile.balances)[payAsset]
  const usdTotal = totalUsdBalance(normalizeBalances(game.profile.balances))
  const checkPreview = game.checkInPreview
  const presets = stakePresets(payAsset, game.profile.highRoller)

  return (
    <div className="relative z-20 flex h-full min-h-0 flex-col">
      {/* Compact brand + stats — first viewport */}
      <header className="shrink-0 px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="font-display text-[clamp(2.4rem,11vw,3.75rem)] leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            ZİNCİR
          </p>
          <p className="mt-0.5 font-display text-lg tracking-[0.32em] text-ice">
            DRONE
          </p>
        </motion.div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-2 text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-fog">Seri</p>
            <p className="font-display text-xl text-signal">
              {game.profile.streak}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-2 text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-fog">Pil</p>
            <p className="font-display text-xl text-amber">
              {game.profile.flightCredits}
            </p>
          </div>
          <button
            type="button"
            onClick={() => game.setScreen('wallet')}
            className="rounded-xl border border-white/10 bg-black/35 px-2 py-2 text-center backdrop-blur-sm"
          >
            <p className="text-[10px] uppercase tracking-wider text-fog">$ </p>
            <p className="font-display text-lg text-ice">
              {formatUsd(usdTotal).replace('$', '')}
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={() => game.setScreen('hangar')}
          className="mx-auto mt-2.5 flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-3.5 py-1.5 backdrop-blur-sm"
        >
          <span className="text-ice">{ICONS[craft.id]}</span>
          <span className="text-sm text-white">
            {craft.name}
            {skin.rarity !== 'common' ? ` · ${skin.name}` : ''}
          </span>
          <span className="text-[10px] text-fog">Hangar</span>
        </button>
      </header>

      {/* Open sky / craft stage */}
      <div className="relative min-h-0 flex-1">
        {game.skyActive && (
          <div className="absolute inset-x-4 top-2 z-10 rounded-full border border-ice/30 bg-ice/15 px-3 py-1.5 text-center text-xs text-ice backdrop-blur-md">
            Gökyüzü {game.formatSkyBonus(game.skyBonus)}
          </div>
        )}
      </div>

      {/* Sticky play dock — always on screen above bottom nav */}
      <div className="shrink-0 px-4 pb-[calc(4.35rem+env(safe-area-inset-bottom))] pt-2">
        <InstallBanner />

        {game.tipVisible && (
          <button
            type="button"
            onClick={game.hideTip}
            className="mb-2 w-full text-center text-xs text-ice/85"
          >
            Kamerayı gökyüzüne çevir — +10–20% · kapat
          </button>
        )}

        {mission && (
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-panel/90 px-3 py-2 backdrop-blur-md">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-fog">
                Görev
              </p>
              <p className="truncate text-sm text-white">{mission.label}</p>
            </div>
            <p className="shrink-0 text-xs text-fog">
              {mission.progress}/{mission.target}
            </p>
          </div>
        )}

        {/* Compact stake row */}
        {game.profile.payWithCrypto && (
          <div className="mb-2 flex items-center justify-center gap-1.5">
            {presets.slice(0, 3).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => game.setStakeAmount(s)}
                className={`min-w-[4.5rem] rounded-full px-2.5 py-1.5 text-xs font-semibold ${
                  Math.abs(stakeAmt - s) < 1e-12
                    ? 'bg-signal/25 text-signal'
                    : 'border border-white/15 text-fog'
                }`}
              >
                {game.profile.highRoller
                  ? formatAsset(s, payAsset)
                  : formatUsd(s)}
              </button>
            ))}
          </div>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={noCredits}
          onClick={() => void game.startFlight()}
          className="relative w-full overflow-hidden rounded-2xl py-4 disabled:opacity-40"
          style={{
            background:
              'linear-gradient(135deg, #1a8f5c 0%, #3dffa8 45%, #7dd3fc 100%)',
            boxShadow: '0 10px 32px rgba(61,255,168,0.28)',
          }}
        >
          <span className="font-display text-3xl tracking-wider text-ink">
            KALKIŞ
          </span>
          <span className="mt-0.5 block text-xs font-medium text-ink/70">
            {noCredits
              ? 'Pil / bakiye yok — Cüzdan'
              : cryptoOk
                ? `${craft.name} · ${
                    game.profile.highRoller
                      ? formatAsset(stakeAmt, payAsset)
                      : formatUsd(stakeAmt)
                  }`
                : `${craft.name} · 1 pil`}
          </span>
        </motion.button>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={!game.canCheckInToday}
            onClick={() => game.doCheckIn()}
            className="flex-1 rounded-xl border border-signal/30 bg-signal/10 py-2 text-xs font-semibold text-signal disabled:opacity-40"
          >
            {game.canCheckInToday
              ? `Check-in · ${checkPreview.label}`
              : `Check-in ✓ · ${game.profile.checkInStreak}`}
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs text-fog"
          >
            {moreOpen ? 'Kapat' : 'Modlar'}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 max-h-[38vh] space-y-2 overflow-y-auto overscroll-contain pb-1">
                <div className="flex flex-wrap justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => game.setHighRoller(false)}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      !game.profile.highRoller
                        ? 'bg-signal/25 text-signal'
                        : 'border border-white/15 text-fog'
                    }`}
                  >
                    Stable $
                  </button>
                  <button
                    type="button"
                    onClick={() => game.setHighRoller(true)}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      game.profile.highRoller
                        ? 'bg-amber/25 text-amber'
                        : 'border border-white/15 text-fog'
                    }`}
                  >
                    High roller
                  </button>
                  {(['usdc', 'usdt'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => game.setPayAsset(id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] ${
                        payAsset === id
                          ? 'bg-ice/25 text-ice'
                          : 'border border-white/15 text-fog'
                      }`}
                    >
                      {id.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-1">
                  <span className="w-full text-center text-[10px] text-fog">
                    Auto {formatAutoCash(game.profile.autoCashOut)}
                  </span>
                  {AUTO_CASH_PRESETS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => game.setAutoCashOut(x)}
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        Math.abs(game.profile.autoCashOut - x) < 1e-9
                          ? 'bg-ice/25 text-ice'
                          : 'border border-white/15 text-fog'
                      }`}
                    >
                      {x === 0 ? 'Kapalı' : `${x}x`}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={noCredits}
                    onClick={() => void game.startFlight({ challenge: true })}
                    className="rounded-xl bg-amber/20 py-2 text-[11px] font-semibold text-amber disabled:opacity-40"
                  >
                    Challenge
                  </button>
                  <button
                    type="button"
                    disabled={noCredits}
                    onClick={() => void game.startFlight({ blind: true })}
                    className="rounded-xl bg-ice/20 py-2 text-[11px] font-semibold text-ice disabled:opacity-40"
                  >
                    Kör
                  </button>
                  <button
                    type="button"
                    disabled={noCredits}
                    onClick={() => void game.startFlight({ weekly: true })}
                    className="rounded-xl bg-signal/20 py-2 text-[11px] font-semibold text-signal disabled:opacity-40"
                  >
                    Lig
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void game.createDuel()}
                    className="rounded-xl border border-white/15 py-2 text-[11px] text-white"
                  >
                    Düello
                  </button>
                  <button
                    type="button"
                    disabled={!game.boostUnlocked}
                    onClick={() => void game.startBoostFlight()}
                    className="rounded-xl bg-amber/15 py-2 text-[11px] text-amber disabled:opacity-40"
                  >
                    Boost $5
                  </button>
                  <button
                    type="button"
                    onClick={() => void game.startChatBlindFlight()}
                    className="rounded-xl bg-ice/15 py-2 text-[11px] text-ice"
                  >
                    Chat kör
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      game.setPayWithStars(!game.profile.payWithStars)
                    }
                    className={`rounded-xl py-2 text-[11px] ${
                      game.profile.payWithStars
                        ? 'bg-amber/25 text-amber'
                        : 'border border-white/15 text-fog'
                    }`}
                  >
                    Stars {game.profile.starsBalance}
                  </button>
                </div>

                <p className="text-center text-[10px] text-fog">
                  {ASSETS[payAsset].symbol} {formatAsset(bal, payAsset)} · bomba{' '}
                  {game.profile.bombs ?? 0}
                  {game.retentionHint ? ` · ${game.retentionHint}` : ''}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
