import { motion } from 'framer-motion'
import type { Screen } from '../game/types'

interface Props {
  screen: Screen
  onNavigate: (s: Screen) => void
}

const ITEMS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Uçuş' },
  { id: 'modes', label: 'VR' },
  { id: 'hangar', label: 'Hangar' },
  { id: 'profile', label: 'Profil' },
]

export function BottomNav({ screen, onNavigate }: Props) {
  if (screen === 'flight' || screen === 'result' || screen === 'vr-play') return null

  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-2xl border border-white/10 bg-panel px-2 py-2 backdrop-blur-md">
        {ITEMS.map((item) => {
          const active =
            screen === item.id || (item.id === 'home' && screen === 'home')
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-sm transition"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-signal/15"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span
                className={`relative font-display text-base tracking-wide ${
                  active ? 'text-signal' : 'text-fog'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
