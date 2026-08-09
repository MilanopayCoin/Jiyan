import { motion } from 'framer-motion'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS, scorePoints } from '../../game/vehicles'
import type { CraftId } from '../../game/types'
import { InstallBanner } from '../InstallBanner'
import { fmtX } from '../../game/math'
import { ASSETS, formatAsset, normalizeBalances } from '../../game/assets'
import { canStakeCrypto } from '../../game/walletOps'
import {
  AUTO_CASH_PRESETS,
  formatAutoCash,
} from '../../game/retention'
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
  const mission = game.profile.missions.find((m) => !m.completed) ?? game.profile.missions[0]
  const payAsset = game.profile.payAsset
  const stakeAmt = game.profile.stakeAmount || (game.profile.highRoller ? ASSETS[payAsset].flightStake : 1)
  const cryptoOk = canStakeCrypto(game.profile, payAsset, stakeAmt)
  const starsOk = game.profile.starsBalance >= game.starsFlightCost
  const noCredits =
    !cryptoOk && !starsOk && game.profile.flightCredits <= 0
  const craft = CRAFTS[game.profile.selectedCraft]
  const skin = SKINS[game.profile.selectedSkin]
  const points = scorePoints(game.profile.totalCashed)
  const bal = normalizeBalances(game.profile.balances)[payAsset]
  const usdTotal = totalUsdBalance(normalizeBalances(game.profile.balances))
  const checkPreview = game.checkInPreview
  const presets = stakePresets(payAsset, game.profile.highRoller)

  return (
    <div className="relative z-20 flex h-full flex-col">
      <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="font-display text-[clamp(3.5rem,14vw,5.5rem)] leading-none text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]">
            ZİNCİR
          </p>
          <p className="mt-1 font-display text-2xl tracking-[0.35em] text-ice">
            DRONE
          </p>
        </motion.div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <div className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-xs text-fog">Seri </span>
            <span className="font-display text-xl text-signal">
              {game.profile.streak}
            </span>
          </div>
          <div className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-xs text-fog">Pil </span>
            <span className="font-display text-xl text-amber">
              {game.profile.flightCredits}
            </span>
          </div>
          <button
            type="button"
            onClick={() => game.setScreen('wallet')}
            className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="text-xs text-fog">Bankroll </span>
            <span className="font-display text-xl text-ice">{formatUsd(usdTotal)}</span>
          </button>
          <button
            type="button"
            onClick={() => game.setScreen('wallet')}
            className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="text-xs text-fog">{ASSETS[payAsset].symbol} </span>
            <span className="font-display text-xl text-ice">
              {formatAsset(bal, payAsset).replace(` ${ASSETS[payAsset].symbol}`, '')}
            </span>
          </button>
          <div className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-xs text-fog">Puan </span>
            <span className="font-display text-xl text-ice">{points}</span>
          </div>
          <div className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-xs text-fog">Bomba </span>
            <span className="font-display text-xl text-amber">
              {game.profile.bombs ?? 0}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void game.purchaseStars()}
            className="rounded-full border border-amber/30 bg-amber/10 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="text-xs text-fog">Stars </span>
            <span className="font-display text-xl text-amber">
              {game.profile.starsBalance}
            </span>
          </button>
          <button
            type="button"
            onClick={() => game.setScreen('wallet')}
            className={`rounded-full border px-4 py-1.5 backdrop-blur-sm ${
              game.profile.walletVerified
                ? 'border-signal/40 bg-signal/15'
                : game.profile.walletAddress
                  ? 'border-amber/40 bg-amber/15'
                  : 'border-[#3b99fc]/40 bg-[#3b99fc]/15'
            }`}
          >
            <span className="text-xs text-fog">Cüzdan </span>
            <span
              className={`font-display text-sm ${
                game.profile.walletVerified
                  ? 'text-signal'
                  : game.profile.walletAddress
                    ? 'text-amber'
                    : 'text-[#7eb8ff]'
              }`}
            >
              {game.profile.walletVerified
                ? 'OK'
                : game.profile.walletAddress
                  ? 'İmza'
                  : 'Bağla'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => game.setScreen('hangar')}
          className="mx-auto mt-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 backdrop-blur-sm"
        >
          <span className="text-ice">{ICONS[craft.id]}</span>
          <span className="text-sm text-white">
            {craft.name}
            {skin.rarity !== 'common' ? ` · ${skin.name}` : ''}
          </span>
          <span className="text-xs text-fog">Hangar →</span>
        </button>
      </header>

      <div className="flex-1" />

      <div className="px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <InstallBanner />

        {game.retentionHint && (
          <p className="mb-3 text-center text-sm text-signal">{game.retentionHint}</p>
        )}

        {game.tipVisible && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={game.hideTip}
            className="mb-4 w-full text-center text-sm text-ice/90"
          >
            Kamerayı gökyüzüne çevir — çarpan +10–20% bonus!
          </motion.button>
        )}

        {game.skyActive && (
          <div className="mb-3 rounded-2xl border border-ice/30 bg-ice/10 px-4 py-2 text-center text-sm text-ice backdrop-blur-md">
            Gökyüzü algılandı {game.formatSkyBonus(game.skyBonus)}
          </div>
        )}

        <button
          type="button"
          disabled={!game.canCheckInToday}
          onClick={() => game.doCheckIn()}
          className="mb-3 flex w-full items-center justify-between rounded-2xl border border-signal/35 bg-signal/10 px-4 py-3 text-left backdrop-blur-md disabled:opacity-45"
        >
          <div>
            <p className="text-xs uppercase tracking-wider text-signal">
              Günlük check-in
            </p>
            <p className="mt-0.5 text-sm text-white">
              {game.canCheckInToday
                ? `Gün ${checkPreview.day}: ${checkPreview.label}`
                : `Alındı · seri ${game.profile.checkInStreak}`}
            </p>
          </div>
          <span className="font-display text-lg text-signal">
            {game.canCheckInToday ? 'AL' : '✓'}
          </span>
        </button>

        {mission && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-panel px-4 py-3 backdrop-blur-md">
            <p className="text-xs uppercase tracking-wider text-fog">Günün görevi</p>
            <p className="mt-1 text-base font-medium text-white">{mission.label}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-signal"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (mission.progress / mission.target) * 100)}%`,
                }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <p className="mt-1 text-xs text-fog">
              {mission.progress}/{mission.target}
              {mission.completed ? ' · tamamlandı' : ''}
            </p>
          </div>
        )}

        <p className="mb-2 text-center text-xs text-fog">{craft.riskLabel}</p>

        <div className="mb-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => game.setHighRoller(false)}
            className={`rounded-full px-3 py-1 text-xs ${
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
            className={`rounded-full px-3 py-1 text-xs ${
              game.profile.highRoller
                ? 'bg-amber/25 text-amber'
                : 'border border-white/15 text-fog'
            }`}
          >
            High roller
          </button>
        </div>

        {!game.profile.highRoller && (
          <div className="mb-2 flex justify-center gap-2">
            {(['usdc', 'usdt'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => game.setPayAsset(id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  payAsset === id
                    ? 'bg-ice/25 text-ice'
                    : 'border border-white/15 text-fog'
                }`}
              >
                {id.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="mb-3">
          <p className="mb-1.5 text-center text-[10px] uppercase tracking-wider text-fog">
            Auto cash-out · {formatAutoCash(game.profile.autoCashOut)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {AUTO_CASH_PRESETS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => game.setAutoCashOut(x)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  Math.abs(game.profile.autoCashOut - x) < 1e-9
                    ? 'bg-ice/25 text-ice'
                    : 'border border-white/15 text-fog'
                }`}
              >
                {x === 0 ? 'Kapalı' : `${x}x`}
              </button>
            ))}
          </div>
        </div>

        {game.profile.payWithCrypto && (
          <div className="mb-3">
            <p className="mb-1.5 text-center text-[10px] uppercase tracking-wider text-fog">
              {game.profile.highRoller ? 'Bahis' : 'Masa'} ·{' '}
              {game.profile.highRoller
                ? formatAsset(stakeAmt, payAsset)
                : formatUsd(stakeAmt)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {presets.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => game.setStakeAmount(s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    Math.abs(stakeAmt - s) < 1e-12
                      ? 'bg-signal/25 text-signal'
                      : 'border border-white/15 text-fog'
                  }`}
                >
                  {game.profile.highRoller
                    ? formatAsset(s, payAsset)
                    : `${formatUsd(s)} USDC`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber">
                Günlük meydan okuma
              </p>
              <p className="mt-0.5 text-sm text-white">
                Aynı seed · herkes aynı düşüş yolu
              </p>
            </div>
            <p className="font-display text-2xl text-amber">
              {game.dailyBest ? fmtX(game.dailyBest.bestMultiplier) : '—'}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={noCredits}
              onClick={() => game.startFlight({ challenge: true })}
              className="flex-1 rounded-xl bg-amber/25 py-2.5 text-sm font-semibold text-amber disabled:opacity-40"
            >
              Challenge
            </button>
            <button
              type="button"
              disabled={noCredits}
              onClick={() => game.startFlight({ blind: true })}
              className="flex-1 rounded-xl bg-ice/20 py-2.5 text-sm font-semibold text-ice disabled:opacity-40"
            >
              Kör Uçuş
            </button>
            <button
              type="button"
              onClick={() => game.shareDaily()}
              className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white"
            >
              Paylaş
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-2xl border border-signal/30 bg-signal/10 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-signal">
                Haftalık lig · {game.weekKey}
              </p>
              <p className="mt-0.5 text-sm text-white">
                Aynı haftalık seed · {game.daysLeftInWeek} gün kaldı
              </p>
            </div>
            <p className="font-display text-2xl text-signal">
              {game.weeklyBest?.bestMultiplier
                ? fmtX(game.weeklyBest.bestMultiplier)
                : '—'}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-signal"
              style={{ width: `${game.seasonProgress.pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-fog">
            Sezon XP {game.season.xp}
            {game.seasonProgress.next
              ? ` · sonraki ${game.seasonProgress.next.label} @ ${game.seasonProgress.next.xp}`
              : ' · pass tamam'}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={noCredits}
              onClick={() => void game.startFlight({ weekly: true })}
              className="flex-1 rounded-xl bg-signal/25 py-2.5 text-sm font-semibold text-signal disabled:opacity-40"
            >
              Lig uçuşu
            </button>
            <button
              type="button"
              onClick={() => game.claimSeason()}
              className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white"
            >
              Ödül al
            </button>
            <button
              type="button"
              onClick={() => game.announceWeekly()}
              className="rounded-xl border border-white/15 px-3 py-2.5 text-sm text-ice"
            >
              Duyur
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-2xl border border-ice/25 bg-ice/10 px-4 py-3 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wider text-ice">
            Telegram filo
          </p>
          <p className="mt-0.5 text-sm text-white">
            Düello · boost · chat kör · Stars
          </p>
          {game.retentionHint && (
            <p className="mt-1 text-xs text-signal">{game.retentionHint}</p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void game.createDuel()}
              className="rounded-xl border border-white/15 py-2 text-xs text-white"
            >
              Düello kur
            </button>
            <button
              type="button"
              disabled={noCredits && game.profile.starsBalance < game.starsFlightCost}
              onClick={() => void game.startDuelFlight()}
              className="rounded-xl bg-signal/20 py-2 text-xs font-semibold text-signal disabled:opacity-40"
            >
              {game.activeDuelId ? 'Düello uç' : 'Düello başlat'}
            </button>
            <button
              type="button"
              disabled={!game.boostUnlocked}
              onClick={() => void game.startBoostFlight()}
              className="rounded-xl bg-amber/20 py-2 text-xs font-semibold text-amber disabled:opacity-40"
            >
              Boost $5
            </button>
            <button
              type="button"
              onClick={() => void game.startChatBlindFlight()}
              className="rounded-xl bg-ice/20 py-2 text-xs font-semibold text-ice"
            >
              Chat kör
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => game.setPayWithStars(!game.profile.payWithStars)}
              className={`rounded-full px-3 py-1 text-[11px] ${
                game.profile.payWithStars
                  ? 'bg-amber/25 text-amber'
                  : 'border border-white/15 text-fog'
              }`}
            >
              Stars bahis · {game.starsFlightCost}⭐
            </button>
            <button
              type="button"
              onClick={() => game.shareChatBlind()}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-fog"
            >
              Chat link
            </button>
            {!game.boostUnlocked && (
              <span className="text-[10px] text-fog">Boost: Premium / kanal</span>
            )}
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={noCredits}
          onClick={() => game.startFlight()}
          className="relative w-full overflow-hidden rounded-2xl py-5 disabled:opacity-40"
          style={{
            background:
              'linear-gradient(135deg, #1a8f5c 0%, #3dffa8 45%, #7dd3fc 100%)',
            boxShadow: '0 12px 40px rgba(61,255,168,0.25)',
          }}
        >
          <span className="font-display text-4xl tracking-wider text-ink">
            KALKIŞ
          </span>
          <span className="mt-1 block text-sm font-medium text-ink/70">
            {noCredits
              ? 'Bakiye / pil yok — Cüzdan’dan yükle'
              : cryptoOk
                ? `${craft.name} · ${
                    game.profile.highRoller
                      ? formatAsset(stakeAmt, payAsset)
                      : formatUsd(stakeAmt)
                  } bahis`
                : `${craft.name} · 1 pil · telefonu eğerek uçur`}
          </span>
        </motion.button>
      </div>
    </div>
  )
}
