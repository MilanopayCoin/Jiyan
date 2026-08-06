import { motion } from 'framer-motion'
import { MODE_ORDER, MODES, PLAYER_ORDER, PLAYERS } from './game/roster'
import { fmtX } from './game/physics'
import type { JuggleApi } from './game/useJuggle'
import { Arena } from './components/Arena'

export function AppShell({ game }: { game: JuggleApi }) {
  if (game.phase === 'menu') {
    return (
      <div
        className="relative z-10 flex h-full flex-col overflow-y-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 0%, #143d2c 0%, #0a1620 55%, #03080e 100%)',
        }}
      >
        <h1 className="font-display text-center text-5xl text-white">
          Top Sektirme
        </h1>
        <p className="mt-1 text-center text-sm text-fog">
          Messi vs Ronaldo · mobil arcade
        </p>

        <p className="mt-6 text-xs uppercase tracking-wider text-fog">Oyuncu</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {PLAYER_ORDER.map((id) => {
            const p = PLAYERS[id]
            const on = game.playerId === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => game.setPlayer(id)}
                className={`rounded-2xl border px-4 py-4 text-left ${
                  on ? 'border-white/40 bg-white/10' : 'border-white/10 bg-panel'
                }`}
                style={on ? { boxShadow: `0 0 0 1px ${p.color}` } : undefined}
              >
                <p className="font-display text-3xl" style={{ color: p.color }}>
                  {p.name}
                </p>
                <p className="text-xs text-fog">{p.tagline}</p>
              </button>
            )
          })}
        </div>

        <p className="mt-6 text-xs uppercase tracking-wider text-fog">Mod</p>
        <div className="mt-2 space-y-2">
          {MODE_ORDER.map((id) => {
            const m = MODES[id]
            const on = game.modeId === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => game.setMode(id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  on
                    ? 'border-signal/40 bg-signal/10'
                    : 'border-white/10 bg-panel'
                }`}
              >
                <p className="font-display text-2xl text-white">{m.name}</p>
                <p className="text-sm text-fog">{m.blurb}</p>
              </button>
            )
          })}
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => game.start()}
          className="mt-6 w-full rounded-2xl py-5"
          style={{
            background: `linear-gradient(135deg, ${game.player.color}, #3dffa8)`,
          }}
        >
          <span className="font-display text-4xl text-ink">BAŞLA</span>
          <span className="mt-1 block text-sm font-medium text-ink/70">
            {game.player.name} · {game.mode.name}
          </span>
        </motion.button>
      </div>
    )
  }

  if (game.phase === 'result' && game.result) {
    const r = game.result
    const won = r.outcome === 'cashed'
    const p = PLAYERS[r.playerId]
    return (
      <div className="relative h-full">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at bottom, #0d3d2a, #0a1620 70%)',
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-10">
          <div className="rounded-3xl border border-white/15 bg-panel p-5 backdrop-blur-xl">
            <p className="font-display text-sm tracking-[0.25em] text-fog">
              {won ? 'KİLİTLENDİ' : 'TOP DÜŞTÜ'}
            </p>
            <p className="mt-1 text-sm" style={{ color: p.color }}>
              {p.name} · {MODES[r.modeId].name}
            </p>
            <p
              className={`mt-2 font-display text-5xl ${
                won ? 'text-signal' : 'text-ronaldo'
              }`}
            >
              {won ? fmtX(r.multiplier) : '0x'}
            </p>
            <p className="mt-2 text-sm text-fog">
              {r.touches} sektirme
              {r.perfects ? ` · ${r.perfects} perfect` : ''}
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
                    ? `${p.name} ile ${fmtX(r.multiplier)} sektirme!`
                    : `${p.name}: top düştü, ${fmtX(r.nearMiss)}'e az kaldı`
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: 'Top Sektirme', text })
                    } else await navigator.clipboard.writeText(text)
                  } catch {
                    /* */
                  }
                }}
                className="rounded-xl border border-white/15 py-3 text-sm"
              >
                Paylaş
              </button>
              <button
                type="button"
                onClick={() => game.start()}
                className="rounded-xl py-3 text-sm font-semibold text-ink"
                style={{
                  background: `linear-gradient(135deg, ${p.color}, #3dffa8)`,
                }}
              >
                Tekrar
              </button>
            </div>
            <button
              type="button"
              onClick={game.toMenu}
              className="mt-3 w-full text-sm text-fog"
            >
              Menü
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 50% 100%, #145c3a 0%, #0a1620 55%, #03080e 100%)',
        }}
      />
      <Arena
        ball={game.ball}
        tiltX={game.tilt.tiltX}
        tiltY={game.tilt.tiltY}
        player={game.player}
      />

      <header className="relative z-10 px-5 pt-[max(1.2rem,env(safe-area-inset-top))]">
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-fog">Oyuncu</p>
            <p className="font-display text-2xl" style={{ color: game.player.color }}>
              {game.player.name}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-fog">Çarpan</p>
            <p className="font-display text-4xl text-signal">{fmtX(game.multiplier)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-fog">Combo</p>
            <p className="font-display text-2xl text-ice">{game.touches}</p>
          </div>
        </div>
        {game.flash && (
          <p className="mt-2 text-center font-display text-xl text-amber">
            {game.flash}
          </p>
        )}
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={game.kick}
            className="min-h-[5.5rem] rounded-2xl border border-white/20 bg-black/45 px-3 py-4 backdrop-blur-md"
          >
            <span className="font-display text-3xl text-ice">SEKTİR</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={game.cashOut}
            disabled={game.touches < 1}
            className="min-h-[5.5rem] rounded-2xl px-3 py-4 disabled:opacity-40"
            style={{
              background: `linear-gradient(145deg, ${game.player.color}, #3dffa8)`,
            }}
          >
            <span className="font-display text-3xl text-ink">KİLİTLE</span>
          </motion.button>
        </div>
        <button
          type="button"
          onClick={game.toMenu}
          className="mt-2 w-full text-center text-xs text-fog"
        >
          Menü
        </button>
      </div>
    </div>
  )
}
