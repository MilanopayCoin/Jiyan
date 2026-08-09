import type { ReactNode } from 'react'
import type { Screen } from '../game/types'
import { isTelegramMiniApp } from '../telegram/webApp'

interface Props {
  screen: Screen
  onNavigate: (s: Screen) => void
}

const ITEMS: {
  id: Screen
  label: string
  icon: (active: boolean) => ReactNode
}[] = [
  {
    id: 'home',
    label: 'Uçuş',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3l2.2 6.2H21l-5.2 3.8 2 6.2L12 15.8 6.2 19.2l2-6.2L3 9.2h6.8L12 3z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill={a ? 'currentColor' : 'none'}
          fillOpacity={a ? 0.25 : 0}
        />
      </svg>
    ),
  },
  {
    id: 'hangar',
    label: 'Hangar',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 20V9l9-5 9 5v11H3z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill={a ? 'currentColor' : 'none'}
          fillOpacity={a ? 0.2 : 0}
        />
        <path d="M9 20v-7h6v7" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'wallet',
    label: 'Cüzdan',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="6"
          width="18"
          height="13"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.6"
          fill={a ? 'currentColor' : 'none'}
          fillOpacity={a ? 0.2 : 0}
        />
        <path d="M16 12.5h3.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'leaderboard',
    label: 'Sıra',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 20V10h4v10H5zm5 0V4h4v16h-4zm5 0v-7h4v7h-4z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill={a ? 'currentColor' : 'none'}
          fillOpacity={a ? 0.2 : 0}
        />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profil',
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle
          cx="12"
          cy="8"
          r="3.2"
          stroke="currentColor"
          strokeWidth="1.6"
          fill={a ? 'currentColor' : 'none'}
          fillOpacity={a ? 0.25 : 0}
        />
        <path
          d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export function BottomNav({ screen, onNavigate }: Props) {
  if (screen === 'flight' || screen === 'result') return null

  const tgPad = isTelegramMiniApp()

  return (
    <nav
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-50 ${
        tgPad ? 'pb-[calc(3.25rem+env(safe-area-inset-bottom))]' : ''
      }`}
    >
      <div
        className="pointer-events-auto border-t border-white/10 bg-[rgb(6_16_24/0.94)] px-1.5 pt-1 backdrop-blur-xl"
        style={{
          paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map((item) => {
            const active = screen === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex min-h-[3.35rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 ${
                  active
                    ? 'bg-signal/12 text-signal'
                    : 'text-fog active:bg-white/5'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon(active)}
                <span className="max-w-full truncate text-[10px] font-semibold leading-none tracking-wide">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
