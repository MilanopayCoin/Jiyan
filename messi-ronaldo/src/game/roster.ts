export type PlayerId = 'messi' | 'ronaldo'
export type ModeId = 'hattrick' | 'keepy' | 'lasttouch'
export type Phase = 'menu' | 'playing' | 'result'

export interface PlayerDef {
  id: PlayerId
  name: string
  tagline: string
  color: string
  accent: number
  kit: number
  /** Kick forgiveness */
  forgive: number
  /** Extra perfect window */
  timingBoost: number
}

export interface ModeDef {
  id: ModeId
  name: string
  blurb: string
  multStep: number
  multStart: number
  gravity: number
}

export const PLAYERS: Record<PlayerId, PlayerDef> = {
  messi: {
    id: 'messi',
    name: 'Messi',
    tagline: 'Sol ayak · yakın kontrol',
    color: '#75aadb',
    accent: 0x75aadb,
    kit: 0x0b3d91,
    forgive: 0.52,
    timingBoost: 0.12,
  },
  ronaldo: {
    id: 'ronaldo',
    name: 'Ronaldo',
    tagline: 'Güç · yüksek sektirme',
    color: '#e11d48',
    accent: 0xe11d48,
    kit: 0x7f1d1d,
    forgive: 0.4,
    timingBoost: 0.05,
  },
}

export const MODES: Record<ModeId, ModeDef> = {
  hattrick: {
    id: 'hattrick',
    name: 'Hat-trick Crash',
    blurb: 'Her sektirme çarpan artırır. KİLİTLE veya top düşünce sıfır.',
    multStep: 0.35,
    multStart: 1,
    gravity: 9.4,
  },
  keepy: {
    id: 'keepy',
    name: 'Keepy-Uppi',
    blurb: 'Mümkün olduğunca uzun tut. Combo süresi skoru büyütür.',
    multStep: 0.14,
    multStart: 1,
    gravity: 7.4,
  },
  lasttouch: {
    id: 'lasttouch',
    name: 'Last Touch',
    blurb: 'Zirvede sektir. Perfect timing = büyük çarpan.',
    multStep: 0.55,
    multStart: 1,
    gravity: 8.6,
  },
}

export const PLAYER_ORDER: PlayerId[] = ['messi', 'ronaldo']
export const MODE_ORDER: ModeId[] = ['hattrick', 'keepy', 'lasttouch']
