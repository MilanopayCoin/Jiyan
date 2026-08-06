import { motion } from 'framer-motion'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'
import { useState } from 'react'

interface Props {
  game: GameApi
}

export function LeaderboardScreen({ game }: Props) {
  const [tab, setTab] = useState<'global' | 'friends'>('global')
  const list =
    tab === 'global'
      ? game.leaderboard
      : game.leaderboard.filter((e) => e.isYou || e.streak >= 5).slice(0, 6)

  return (
    <div className="relative z-20 flex h-full flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display text-4xl text-white">Sıralama</h1>
      <p className="mt-1 text-sm text-fog">En yüksek irtifa · günlük seri</p>

      <div className="mt-4 flex gap-2">
        {(['global', 'friends'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? 'bg-signal/20 text-signal'
                : 'bg-white/5 text-fog'
            }`}
          >
            {t === 'global' ? 'Global' : 'Arkadaşlar'}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {list.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md ${
              entry.isYou
                ? 'border-signal/40 bg-signal/10'
                : 'border-white/10 bg-panel'
            }`}
          >
            <span className="font-display w-8 text-xl text-fog">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{entry.name}</p>
              <p className="text-xs text-fog">
                Seri {entry.streak} · Katman {entry.bestLayer}
              </p>
            </div>
            <span className="font-display text-2xl text-ice">
              {entry.bestMultiplier > 0 ? fmtX(entry.bestMultiplier) : '—'}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
