import { motion } from 'framer-motion'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS, scorePoints } from '../../game/vehicles'
import type { CraftId } from '../../game/types'

interface Props {
  game: GameApi
}

const ICONS: Record<CraftId, string> = {
  drone: '◈',
  plane: '✈',
  rocket: '▲',
  balloon: '○',
}

export function HomeScreen({ game }: Props) {
  const mission = game.profile.missions.find((m) => !m.completed) ?? game.profile.missions[0]
  const noCredits = game.profile.flightCredits <= 0
  const craft = CRAFTS[game.profile.selectedCraft]
  const skin = SKINS[game.profile.selectedSkin]
  const points = scorePoints(game.profile.totalCashed)

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
          <div className="rounded-full border border-white/15 bg-black/35 px-4 py-1.5 backdrop-blur-sm">
            <span className="text-xs text-fog">Puan </span>
            <span className="font-display text-xl text-ice">{points}</span>
          </div>
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
        {game.tipVisible && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={game.hideTip}
            className="mb-4 w-full text-center text-sm text-ice/90"
          >
            Kamerayı gökyüzüne çevir — en iyi deneyim için!
          </motion.button>
        )}

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
              ? 'Pil bitti — yarın yenilenir'
              : `${craft.name} ile başparmakla başlat`}
          </span>
        </motion.button>
      </div>
    </div>
  )
}
