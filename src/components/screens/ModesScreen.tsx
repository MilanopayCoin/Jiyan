import { motion } from 'framer-motion'
import { VR_MODE_ORDER, VR_MODES } from '../../game/modes'
import type { VrModeApi } from '../../game/useVrMode'
import type { GameApi } from '../../game/useGame'

interface Props {
  vr: VrModeApi
  game: GameApi
}

export function ModesScreen({ vr, game }: Props) {
  return (
    <div className="relative z-20 flex h-full flex-col overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display text-4xl text-white">VR Modlar</h1>
      <p className="mt-1 text-sm text-fog">
        Messi dokunuşu · top sektirme · cihazı çevirerek bak
      </p>

      <div className="mt-5 space-y-3">
        {VR_MODE_ORDER.map((id, i) => {
          const mode = VR_MODES[id]
          const selected = vr.modeId === id
          return (
            <motion.button
              key={id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => vr.selectMode(id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left backdrop-blur-md ${
                selected
                  ? 'border-signal/50 bg-signal/10'
                  : 'border-white/10 bg-panel'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-2xl text-white">{mode.name}</p>
                  <p className="text-sm text-ice">{mode.tagline}</p>
                </div>
                {selected && (
                  <span className="text-xs uppercase tracking-wider text-signal">
                    Seçili
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-fog">{mode.blurb}</p>
              <p className="mt-2 text-xs text-amber">{mode.riskLabel}</p>
            </motion.button>
          )
        })}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={!vr.modeId}
        onClick={async () => {
          game.setScreen('vr-play')
          await vr.start()
        }}
        className="mt-6 w-full rounded-2xl py-5 disabled:opacity-40"
        style={{
          background:
            'linear-gradient(135deg, #1a8f5c 0%, #3dffa8 45%, #7dd3fc 100%)',
        }}
      >
        <span className="font-display text-3xl tracking-wider text-ink">
          VR BAŞLAT
        </span>
        <span className="mt-1 block text-sm font-medium text-ink/70">
          Jiroskop + dokunarak sektir
        </span>
      </motion.button>

      <button
        type="button"
        onClick={() => game.setScreen('home')}
        className="mt-3 text-center text-sm text-fog"
      >
        Klasik Zincir uçuşuna dön
      </button>
    </div>
  )
}
