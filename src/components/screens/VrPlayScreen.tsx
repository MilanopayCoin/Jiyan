import { motion } from 'framer-motion'
import { fmtX } from '../../game/math'
import type { VrModeApi } from '../../game/useVrMode'
import type { GameApi } from '../../game/useGame'
import { VrArenaScene } from '../VrArenaScene'

interface Props {
  vr: VrModeApi
  game: GameApi
}

export function VrPlayScreen({ vr, game }: Props) {
  const mode = vr.mode
  if (!mode) {
    return (
      <div className="relative z-20 flex h-full items-center justify-center">
        <button
          type="button"
          className="text-ice"
          onClick={() => game.setScreen('modes')}
        >
          Mod seç
        </button>
      </div>
    )
  }

  if (vr.phase === 'ended' && vr.result) {
    const r = vr.result
    const won = r.outcome === 'cashed' || r.outcome === 'scored'
    return (
      <div className="relative z-30 flex h-full flex-col items-center justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <VrArenaScene
          ball={vr.ball}
          lookX={vr.looking.lookX}
          lookY={vr.looking.lookY}
          playing={false}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 w-full max-w-md rounded-3xl border border-white/15 bg-panel p-5 backdrop-blur-xl"
        >
          <p className="font-display text-sm tracking-[0.25em] text-fog">
            {won ? 'KİLİTLENDİ' : 'TOP DÜŞTÜ'}
          </p>
          <p className="mt-1 text-sm text-ice">{mode.name}</p>
          <p
            className={`mt-2 font-display text-5xl ${
              won ? 'text-signal' : 'text-danger'
            }`}
          >
            {won ? fmtX(r.multiplier) : '0x'}
          </p>
          <p className="mt-2 text-sm text-fog">
            {r.touches} sektirme
            {r.perfects > 0 ? ` · ${r.perfects} perfect` : ''}
          </p>
          {!won && (
            <p className="mt-3 font-display text-xl text-amber">
              {fmtX(r.nearMiss)}&apos;e AZ KALDI!
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                const text = won
                  ? `Zincir VR — ${mode.name}: ${fmtX(r.multiplier)} (${r.touches} sektirme)`
                  : `Zincir VR — ${mode.name}: top düştü, ${fmtX(r.nearMiss)}'e az kaldı`
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: 'Zincir VR',
                      text,
                      url: location.href,
                    })
                  } else await navigator.clipboard.writeText(text)
                } catch {
                  /* cancel */
                }
              }}
              className="rounded-xl border border-white/15 py-3 text-sm text-white"
            >
              Paylaş
            </button>
            <button
              type="button"
              onClick={() => vr.start()}
              className="rounded-xl py-3 text-sm font-semibold text-ink"
              style={{
                background: 'linear-gradient(135deg, #3dffa8, #7dd3fc)',
              }}
            >
              Tekrar
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              vr.exit()
              game.reloadProfile()
              game.setScreen('modes')
            }}
            className="mt-3 w-full text-center text-sm text-fog"
          >
            Modlara dön
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative z-20 flex h-full flex-col">
      <VrArenaScene
        ball={vr.ball}
        lookX={vr.looking.lookX}
        lookY={vr.looking.lookY}
        playing={vr.phase === 'playing'}
      />

      <header className="relative z-10 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-fog">Mod</p>
            <p className="font-display text-xl text-white">{mode.name}</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-fog">Çarpan</p>
            <p className="font-display text-4xl text-signal pulse-glow">
              {fmtX(vr.multiplier)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-fog">Combo</p>
            <p className="font-display text-xl text-ice">{vr.touches}</p>
          </div>
        </div>
        {vr.message && (
          <p className="mt-2 text-center font-display text-lg text-amber">
            {vr.message}
          </p>
        )}
        <p className="mt-2 text-center text-xs text-fog">
          Telefonu çevirerek bak · sektirmek için dokun
        </p>
      </header>

      <div className="relative z-10 mt-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={vr.kick}
            disabled={vr.phase !== 'playing'}
            className="min-h-[5.5rem] rounded-2xl border border-ice/30 bg-sky-mid/85 px-3 py-4 backdrop-blur-md disabled:opacity-40"
          >
            <span className="font-display text-3xl tracking-wide text-ice">
              SEKTİR
            </span>
            <span className="mt-1 block text-xs text-fog">Topa dokun</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={vr.cashOut}
            disabled={vr.phase !== 'playing' || vr.touches < 1}
            className="min-h-[5.5rem] rounded-2xl px-3 py-4 disabled:opacity-40"
            style={{
              background:
                'linear-gradient(145deg, rgba(26,143,92,0.9), rgba(61,255,168,0.95))',
            }}
          >
            <span className="font-display text-3xl tracking-wide text-ink">
              KİLİTLE
            </span>
            <span className="mt-1 block text-xs text-ink/70">Kazancı al</span>
          </motion.button>
        </div>
        <button
          type="button"
          onClick={() => {
            vr.exit()
            game.reloadProfile()
            game.setScreen('modes')
          }}
          className="mt-3 w-full text-center text-xs text-fog"
        >
          Çık
        </button>
      </div>
    </div>
  )
}
