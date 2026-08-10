import { motion } from 'framer-motion'
import type { GameApi } from '../../game/useGame'
import { CRAFT_ORDER, CRAFTS, skinsForCraft, scorePoints } from '../../game/vehicles'
import type { CraftId, RiskTone } from '../../game/types'

interface Props {
  game: GameApi
}

const TONE: Record<RiskTone, string> = {
  calm: 'text-ice',
  safe: 'text-signal',
  balanced: 'text-amber',
  wild: 'text-danger',
  trick: 'text-signal',
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

export function HangarScreen({ game }: Props) {
  const { profile } = game
  const points = scorePoints(profile.totalCashed)
  const selected = profile.selectedCraft

  return (
    <div className="relative z-20 flex h-full flex-col overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display text-4xl text-white">Hangar</h1>
      <p className="mt-1 text-sm text-fog">Araç seç · kilidi aç · nadir skin</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-sm">
          <span className="text-fog">Puan </span>
          <span className="font-display text-lg text-ice">{points}</span>
        </div>
        <div className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-sm">
          <span className="text-fog">Bomba </span>
          <span className="font-display text-lg text-amber">{profile.bombs ?? 0}</span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-amber/25 bg-amber/10 px-4 py-3">
        <p className="font-display text-xl text-amber">Sinyal Bombası</p>
        <p className="mt-1 text-xs text-fog">
          Uçuşta kullan → sonraki YÜKSEL düşmez. Her gün +1 (max 5).
        </p>
        <button
          type="button"
          onClick={() => game.purchaseBomb()}
          className="mt-2 rounded-xl bg-amber/25 px-3 py-2 text-sm font-medium text-amber"
        >
          {game.bombCost} puan ile bomba al
        </button>
      </div>

      {game.hangarMessage && (
        <p className="mt-3 rounded-xl border border-signal/30 bg-signal/10 px-3 py-2 text-sm text-signal">
          {game.hangarMessage}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {CRAFT_ORDER.map((id) => {
          const craft = CRAFTS[id]
          const unlocked = profile.unlockedCrafts.includes(id)
          const active = selected === id
          return (
            <motion.div
              key={id}
              layout
              className={`rounded-2xl border px-4 py-3 backdrop-blur-md ${
                active
                  ? 'border-signal/50 bg-signal/10'
                  : 'border-white/10 bg-panel'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="font-display text-3xl text-ice">{ICONS[id]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-2xl text-white">{craft.name}</p>
                    {active && (
                      <span className="text-xs uppercase tracking-wider text-signal">
                        Seçili
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-fog">{craft.tagline}</p>
                  <p className={`mt-1 text-xs ${TONE[craft.riskTone]}`}>
                    {craft.riskLabel}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => game.selectCraft(id)}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white"
                  >
                    {active ? 'Kullanılıyor' : 'Seç'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => game.buyCraft(id, 'points')}
                    className="rounded-xl bg-ice/15 px-3 py-2 text-sm font-medium text-ice"
                  >
                    {craft.unlockScore > 0
                      ? craft.unlockScore
                      : craft.unlockCredits}{' '}
                    puan ile aç
                  </button>
                )}
              </div>

              {unlocked && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-wider text-fog">Skinler</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skinsForCraft(id).map((skin) => {
                      const have = profile.unlockedSkins.includes(skin.id)
                      const wearing = profile.selectedSkin === skin.id
                      return (
                        <button
                          key={skin.id}
                          type="button"
                          onClick={() => {
                            if (have) game.selectCraft(id, skin.id)
                            else game.buySkin(skin.id, 'points')
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            wearing
                              ? 'border-signal text-signal'
                              : have
                                ? 'border-white/20 text-white'
                                : 'border-amber/40 text-amber'
                          }`}
                        >
                          {skin.name}
                          {!have && skin.rarity !== 'common'
                            ? skin.requireBestX
                              ? ` · ${skin.requireBestX}x veya ${skin.unlockCredits} puan`
                              : skin.requireStreak
                                ? ` · seri ${skin.requireStreak} veya ${skin.unlockCredits} puan`
                                : ` · ${skin.unlockCredits} puan`
                            : ''}
                          {skin.rarity === 'legendary' ? ' ★' : skin.rarity === 'rare' ? ' ◆' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

                  <p className="mt-6 text-center text-xs text-fog">
        Nadir skinler paylaşım kartında görünür — sosyal statü için uç.
      </p>
    </div>
  )
}
