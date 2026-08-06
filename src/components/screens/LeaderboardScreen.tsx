import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'
import {
  decodeFriendCode,
  encodeFriendCode,
  friendInviteUrl,
  profileToCard,
} from '../../game/friends'
import { sfx } from '../../utils/audio'

interface Props {
  game: GameApi
}

export function LeaderboardScreen({ game }: Props) {
  const [tab, setTab] = useState<'global' | 'friends'>('global')
  const [codeInput, setCodeInput] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const list =
    tab === 'global' ? game.leaderboard : game.friendsLeaderboard

  const shareInvite = async () => {
    setBusy(true)
    void sfx.unlock()
    const card = profileToCard(game.profile)
    const url = friendInviteUrl(card)
    const text = `Zincir: Drone — beni arkadaş olarak ekle!\n${url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Zincir: Drone', text, url })
      } else {
        await navigator.clipboard.writeText(url)
        setHint('Davet linki kopyalandı')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(encodeFriendCode(card))
        setHint('Arkadaş kodu kopyalandı')
      } catch {
        setHint('Paylaşım iptal')
      }
    } finally {
      setBusy(false)
      window.setTimeout(() => setHint(null), 2500)
    }
  }

  const addFriend = () => {
    const card = decodeFriendCode(codeInput)
    if (!card) {
      setHint('Geçersiz kod veya link')
      window.setTimeout(() => setHint(null), 2200)
      return
    }
    const ok = game.addFriend(card)
    setHint(ok ? `${card.name} eklendi` : 'Kendini ekleyemezsin')
    setCodeInput('')
    window.setTimeout(() => setHint(null), 2200)
  }

  useEffect(() => {
    setHint(null)
  }, [tab])

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

      {tab === 'friends' && (
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-panel p-3 backdrop-blur-md">
          <p className="text-xs text-fog">
            Davet linki veya ZD1 kodu ile gerçek arkadaş ekle — skorlar cihazında
            saklanır.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={shareInvite}
              className="flex-1 rounded-xl bg-signal/20 py-2.5 text-sm font-medium text-signal disabled:opacity-50"
            >
              Davet et
            </button>
            <button
              type="button"
              onClick={addFriend}
              className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-medium text-white"
            >
              Kodu ekle
            </button>
          </div>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Link veya ZD1.…"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-fog/60 focus:border-ice/40"
          />
          {hint && <p className="text-center text-xs text-ice">{hint}</p>}
        </div>
      )}

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {tab === 'friends' && list.length <= 1 && (
          <p className="py-8 text-center text-sm text-fog">
            Henüz arkadaş yok. Davet gönder veya bir kod yapıştır.
          </p>
        )}
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
            {tab === 'friends' && !entry.isYou && (
              <button
                type="button"
                aria-label="Kaldır"
                onClick={() => game.removeFriend(entry.id)}
                className="ml-1 text-xs text-fog hover:text-danger"
              >
                ✕
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
