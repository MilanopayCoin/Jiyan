import { motion } from 'framer-motion'
import { getLayerInfo } from '../../game/math'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'

interface Props {
  game: GameApi
}

export function FlightScreen({ game }: Props) {
  const craftId = game.profile.selectedCraft
  const next = getLayerInfo(Math.max(1, game.layer + 1), craftId)
  const canAct = game.phase === 'climbing' && game.layer >= 1
  const ledColor =
    game.led === 'safe'
      ? 'text-signal'
      : game.led === 'caution'
        ? 'text-amber'
        : 'text-danger'

  return (
    <div className="relative z-20 flex h-full flex-col">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-fog">İrtifa</p>
            <p className="font-display text-3xl text-white">
              K{game.layer || '—'}
            </p>
          </div>
          <motion.div
            key={game.multiplier}
            initial={{ scale: 1.25, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-right"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-fog">Çarpan</p>
            <p className={`font-display text-[clamp(3rem,12vw,4.5rem)] leading-none ${ledColor} pulse-glow`}>
              {game.layer === 0 ? '—' : fmtX(game.multiplier)}
            </p>
          </motion.div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-fog">Sinyal</p>
            <p className={`font-display text-3xl ${ledColor}`}>
              {game.led === 'safe' ? '●' : game.led === 'caution' ? '◐' : '○'}
            </p>
          </div>
        </div>

        {game.layer >= 3 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            className="mt-3 text-center text-xs text-fog wind-layer"
          >
            Rüzgar artıyor · sinyal zayıflıyor
          </motion.p>
        )}
      </header>

      <div className="flex-1" />

      <div className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 text-center text-xs text-fog">
          Sonraki katman ≈ {fmtX(next.multiplier)}
        </p>
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
            <span className="mt-1 block text-xs text-fog">Risk artır</span>
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
