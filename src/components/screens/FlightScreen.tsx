import { motion } from 'framer-motion'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'

interface Props {
  game: GameApi
}

export function FlightScreen({ game }: Props) {
  const canAct = game.phase === 'climbing' && game.layer >= 1
  const led = game.displayLed
  const ledColor = game.bombArmed
    ? 'text-signal'
    : led === 'safe'
      ? 'text-signal'
      : led === 'caution'
        ? 'text-amber'
        : 'text-danger'
  const skyLabel = game.formatSkyBonus(game.skyBonus)
  const deepBlind = game.blindMode && game.layer >= 3

  return (
    <div className="relative z-20 flex h-full flex-col">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {game.challengeMode && (
          <p className="mb-2 text-center font-display text-sm tracking-[0.25em] text-amber">
            GÜNLÜK CHALLENGE · bomba/gökyüzü kapalı
          </p>
        )}
        {game.blindMode && (
          <p className="mb-2 text-center font-display text-sm tracking-[0.25em] text-ice">
            KÖR UÇUŞ · LED + ses + titreşim
          </p>
        )}
        {game.profile.selectedCraft === 'ufo' && game.ufoShieldReady && (
          <p className="mb-2 text-center text-xs text-signal">
            UFO faz kalkanı hazır · 1 kaçış
          </p>
        )}
        {game.bluffLed && (
          <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-fog/80">
            Sinyal güvenilmez olabilir
          </p>
        )}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-fog">İrtifa</p>
            <p className="font-display text-3xl text-white">
              {deepBlind ? '?' : `K${game.layer || '—'}`}
            </p>
          </div>
          <motion.div
            key={`${game.multiplier}-${game.skyBonus}-${led}`}
            initial={{ scale: 1.25, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-right"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-fog">Çarpan</p>
            <p
              className={`font-display text-[clamp(3rem,12vw,4.5rem)] leading-none ${ledColor} pulse-glow`}
            >
              {game.layer === 0 ? '—' : deepBlind ? '??x' : fmtX(game.multiplier)}
            </p>
            {game.skyActive && !game.blindMode && (
              <p className="text-xs font-medium text-ice">gökyüzü {skyLabel}</p>
            )}
          </motion.div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-fog">
              {game.bombArmed ? 'Kalkan' : 'Sinyal'}
            </p>
            <p className={`font-display text-3xl ${ledColor}`}>
              {game.bombArmed
                ? '◈'
                : led === 'safe'
                  ? '●'
                  : led === 'caution'
                    ? '◐'
                    : '○'}
            </p>
          </div>
        </div>

        {game.skyActive && !game.blindMode && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-full border border-ice/30 bg-ice/10 px-3 py-1.5 text-center text-xs text-ice backdrop-blur-sm"
          >
            Gökyüzü bonusu aktif {skyLabel} — kamerayı yukarı tut
          </motion.div>
        )}

        {game.bombArmed && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-center text-sm font-medium text-signal"
          >
            Sinyal kalkanı aktif — sonraki YÜKSEL güvende
          </motion.p>
        )}

        {deepBlind && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            className="mt-3 text-center text-xs text-ice"
          >
            Görüş kayboldu — LED ve titreşime güven
          </motion.p>
        )}

        {!game.bombArmed && !game.skyActive && !deepBlind && game.layer >= 3 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            className="mt-3 text-center text-xs text-fog wind-layer"
          >
            {game.profile.selectedCraft === 'kite'
              ? 'İp geriliyor · telefonu eğ'
              : 'Rüzgar artıyor · sinyal zayıflıyor'}
          </motion.p>
        )}
      </header>

      <div className="flex-1" />

      <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-center text-xs text-fog">
          {deepBlind
            ? 'Sonraki katman gizli'
            : `Sonraki katman ≈ ${fmtX(game.previewNextMultiplier)}`}
          {game.bombArmed ? ' · kalkanlı' : ''}
          {game.skyActive && !game.blindMode ? ` · gökyüzü ${skyLabel}` : ''}
        </p>

        {!game.challengeMode && !game.blindMode && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={!canAct || game.bombArmed || (game.profile.bombs ?? 0) <= 0}
            onClick={() => game.armBomb()}
            className="mb-3 w-full rounded-2xl border border-amber/40 bg-amber/15 py-3.5 backdrop-blur-md disabled:opacity-35"
          >
            <span className="font-display text-2xl tracking-wide text-amber">
              SİNYAL BOMBASI
            </span>
            <span className="mt-0.5 block text-xs text-fog">
              {game.bombArmed
                ? 'Kalkan hazır'
                : (game.profile.bombs ?? 0) > 0
                  ? `Stok ${game.profile.bombs} · sonraki yükselişi koru`
                  : 'Stok yok — hangardan al'}
            </span>
          </motion.button>
        )}

        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={!canAct}
            onClick={game.climb}
            className="min-h-[5.5rem] rounded-2xl border border-ice/30 bg-sky-mid/80 px-3 py-4 backdrop-blur-md disabled:opacity-35"
          >
            <span className="font-display text-3xl tracking-wide text-ice">
              YÜKSEL
            </span>
            <span className="mt-1 block text-xs text-fog">
              {game.bombArmed ? 'Güvenli sıçra' : 'Risk artır'}
            </span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={!canAct}
            onClick={game.cashOut}
            className="min-h-[5.5rem] rounded-2xl px-3 py-4 disabled:opacity-35"
            style={{
              background:
                'linear-gradient(145deg, rgba(26,143,92,0.9), rgba(61,255,168,0.95))',
            }}
          >
            <span className="font-display text-3xl tracking-wide text-ink">
              İNDİR
            </span>
            <span className="mt-1 block text-xs text-ink/70">Kazancı kilitle</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
