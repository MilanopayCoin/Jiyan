import { BADGE_LABELS } from '../../game/storage'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS, scorePoints } from '../../game/vehicles'

interface Props {
  game: GameApi
}

export function ProfileScreen({ game }: Props) {
  const { profile } = game
  const craft = CRAFTS[profile.selectedCraft]
  const skin = SKINS[profile.selectedSkin]
  const points = scorePoints(profile.totalCashed)

  return (
    <div className="relative z-20 flex h-full flex-col overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="font-display text-4xl text-white">Profil</h1>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-fog">Pilot adı</span>
        <input
          type="text"
          maxLength={16}
          defaultValue={profile.displayName}
          onBlur={(e) => game.rename(e.target.value.trim())}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-signal/50"
        />
      </label>

      <button
        type="button"
        onClick={() => game.setScreen('hangar')}
        className="mt-3 rounded-2xl border border-white/10 bg-panel px-4 py-3 text-left backdrop-blur-md"
      >
        <p className="text-xs text-fog">Aktif filo</p>
        <p className="font-display text-2xl text-ice">
          {craft.name}
          {skin.rarity !== 'common' ? ` · ${skin.name}` : ''}
        </p>
        <p className="text-xs text-fog">
          {profile.unlockedCrafts.length} araç · {profile.unlockedSkins.length}{' '}
          skin · Hangar →
        </p>
      </button>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { label: 'Rekor', value: profile.bestMultiplier ? fmtX(profile.bestMultiplier) : '—' },
          { label: 'Seri', value: String(profile.streak) },
          { label: 'Uçuş', value: String(profile.flights) },
          { label: 'Puan', value: String(points) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-panel px-4 py-3 backdrop-blur-md"
          >
            <p className="text-xs text-fog">{stat.label}</p>
            <p className="font-display text-3xl text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-6 font-display text-2xl text-ice">Rozetler</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {profile.badges.length === 0 && (
          <p className="text-sm text-fog">Henüz rozet yok</p>
        )}
        {profile.badges.map((b) => (
          <span
            key={b}
            className="rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-sm text-amber"
          >
            {BADGE_LABELS[b] ?? b}
          </span>
        ))}
      </div>

      <h2 className="mt-6 font-display text-2xl text-ice">Görevler</h2>
      <ul className="mt-3 space-y-2">
        {profile.missions.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm backdrop-blur-md"
          >
            <div className="flex justify-between gap-2">
              <span className={m.completed ? 'text-signal' : 'text-white'}>
                {m.label}
              </span>
              <span className="text-fog">
                {m.progress}/{m.target}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-display text-2xl text-ice">Son uçuşlar</h2>
      <ul className="mt-3 space-y-2">
        {profile.history.length === 0 && (
          <li className="text-sm text-fog">Henüz uçuş yok</li>
        )}
        {profile.history.slice(0, 8).map((h) => (
          <li
            key={h.timestamp}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm backdrop-blur-md"
          >
            <span className={h.outcome === 'cashed' ? 'text-signal' : 'text-danger'}>
              {CRAFTS[h.craftId ?? 'drone'].name} ·{' '}
              {h.outcome === 'cashed' ? 'İniş' : 'Düşüş'} · K{h.layer}
            </span>
            <span className="font-display text-xl text-white">
              {h.outcome === 'cashed' ? fmtX(h.multiplier) : '0x'}
            </span>
          </li>
        ))}
      </ul>

      {profile.streak >= 1 && profile.lastFlightDate && (
        <p className="mt-6 text-center text-xs text-amber">
          Filon tehlikede! Bugün uçmazsan {profile.streak} günlük serin
          sıfırlanabilir.
        </p>
      )}
    </div>
  )
}
