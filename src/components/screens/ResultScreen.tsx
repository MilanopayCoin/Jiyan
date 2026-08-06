import { motion } from 'framer-motion'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS } from '../../game/vehicles'

interface Props {
  game: GameApi
}

export function ResultScreen({ game }: Props) {
  const result = game.result
  if (!result) return null

  const won = result.outcome === 'cashed'
  const craft = CRAFTS[result.craftId]
  const skin = SKINS[result.skinId]
  const rare = skin.rarity !== 'common'

  const share = async () => {
    const craftBit = rare ? `${craft.name} (${skin.name})` : craft.name
    const sky =
      result.skyBonus && result.skyBonus > 0
        ? ` gökyüzü +${Math.round(result.skyBonus * 100)}%`
        : ''
    const text = won
      ? `Zincir: Drone — ${craftBit} ile ${fmtX(result.multiplier)} indirdim!${sky}`
      : `Zincir: Drone — ${craftBit} ile ${fmtX(result.nearMissMultiplier)}'e az kaldı!${sky}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Zincir: Drone', text, url: location.href })
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // user cancelled
    }
  }

  return (
    <div className="relative z-30 flex h-full flex-col items-center justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="mb-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-panel backdrop-blur-xl"
      >
        <div
          className="px-5 py-6 text-center"
          style={{
            background: won
              ? 'linear-gradient(180deg, rgba(61,255,168,0.18), transparent)'
              : 'linear-gradient(180deg, rgba(255,77,106,0.22), transparent)',
          }}
        >
          <p className="font-display text-sm tracking-[0.3em] text-fog">
            {won ? 'GÜVENLİ İNİŞ' : 'SİNYAL KESİLDİ'}
          </p>
          <p className="mt-1 text-sm text-ice">
            {craft.name}
            {rare ? ` · ${skin.name}` : ''}
          </p>
          <p
            className={`mt-2 font-display text-[clamp(3.5rem,16vw,5rem)] leading-none ${
              won ? 'text-signal' : 'text-danger'
            }`}
          >
            {won ? fmtX(result.multiplier) : '0x'}
          </p>
          <p className="mt-2 text-sm text-fog">
            Katman {result.layer || 0}
            {won ? ' · kilitlendi' : ' · kazanç sıfır'}
          </p>

          {!won && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-5 font-display text-2xl text-amber"
            >
              {fmtX(result.nearMissMultiplier)}&apos;e AZ KALDI!
            </motion.p>
          )}
          {!won && (
            <p className="mt-2 text-sm text-fog">
              Devam etseydin: {fmtX(result.nearMissMultiplier)} kazanacaktın
            </p>
          )}
          {won && result.bombUsed && (
            <p className="mt-2 text-xs text-amber">Sinyal bombası kullanıldı</p>
          )}
          {won && result.skyBonus && result.skyBonus > 0 && (
            <p className="mt-2 text-xs text-ice">
              Gökyüzü bonusu +{Math.round(result.skyBonus * 100)}%
            </p>
          )}
          {won && (
            <p className="mt-4 text-sm text-ice">
              Bir sonraki katman {fmtX(result.nearMissMultiplier)} idi — iyi
              indirdin.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={share}
            className="rounded-xl border border-white/15 bg-white/5 py-3.5 text-sm font-medium text-white"
          >
            Paylaş
          </button>
          <button
            type="button"
            onClick={() => {
              if (game.profile.flightCredits > 0) game.startFlight()
              else game.goHome()
            }}
            className="rounded-xl py-3.5 text-sm font-semibold text-ink"
            style={{
              background: 'linear-gradient(135deg, #3dffa8, #7dd3fc)',
            }}
          >
            Tekrar uç
          </button>
        </div>
      </motion.div>

      <button
        type="button"
        onClick={game.goHome}
        className="mb-2 text-sm text-fog underline-offset-4 hover:underline"
      >
        Ana ekrana dön
      </button>
    </div>
  )
}
