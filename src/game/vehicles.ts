import type { CraftId, CraftSkinId, RiskTone } from './types'

export interface CraftProfile {
  id: CraftId
  name: string
  tagline: string
  riskLabel: string
  riskTone: RiskTone
  /** Relative visual climb speed (1 = drone) */
  climbVisual: number
  /** Multipliers for layers 1–5, then growth base & factor for 6+ */
  multipliers: [number, number, number, number, number]
  multGrowthBase: number
  multGrowthFactor: number
  /** Crash chances for layers 1–5, then per-layer add & cap for 6+ */
  crashChances: [number, number, number, number, number]
  crashStep: number
  crashCap: number
  unlockCredits: number
  unlockScore: number
  defaultSkin: CraftSkinId
}

export interface SkinDef {
  id: CraftSkinId
  craftId: CraftId
  name: string
  rarity: 'common' | 'rare' | 'legendary'
  unlockCredits: number
  /** Optional milestone unlock (OR with credits) */
  requireBestX?: number
  requireStreak?: number
  bodyColor: number
  accentColor: number
  emissiveBoost?: number
}

export const CRAFTS: Record<CraftId, CraftProfile> = {
  drone: {
    id: 'drone',
    name: 'Drone',
    tagline: 'Başlangıç · dengeli',
    riskLabel: 'Orta risk / orta ödül',
    riskTone: 'balanced',
    climbVisual: 1,
    multipliers: [1.2, 1.5, 2.0, 3.0, 5.0],
    multGrowthBase: 5,
    multGrowthFactor: 1.6,
    crashChances: [0.02, 0.05, 0.09, 0.15, 0.25],
    crashStep: 0.1,
    crashCap: 0.92,
    unlockCredits: 0,
    unlockScore: 0,
    defaultSkin: 'drone-default',
  },
  plane: {
    id: 'plane',
    name: 'Uçak',
    tagline: 'Hızlı yükseliş · güvenli',
    riskLabel: 'Düşük risk · yavaş çarpan',
    riskTone: 'safe',
    climbVisual: 1.35,
    multipliers: [1.1, 1.25, 1.4, 1.6, 1.9],
    multGrowthBase: 1.9,
    multGrowthFactor: 1.25,
    crashChances: [0.01, 0.025, 0.045, 0.07, 0.11],
    crashStep: 0.05,
    crashCap: 0.55,
    unlockCredits: 8,
    unlockScore: 15,
    defaultSkin: 'plane-default',
  },
  rocket: {
    id: 'rocket',
    name: 'Roket',
    tagline: 'Yüksek risk · yüksek ödül',
    riskLabel: 'Agresif düşme · hızlı çarpan',
    riskTone: 'wild',
    climbVisual: 1.55,
    multipliers: [1.5, 2.5, 4.0, 7.0, 12.0],
    multGrowthBase: 12,
    multGrowthFactor: 2.0,
    crashChances: [0.05, 0.12, 0.22, 0.35, 0.5],
    crashStep: 0.12,
    crashCap: 0.95,
    unlockCredits: 12,
    unlockScore: 25,
    defaultSkin: 'rocket-default',
  },
  balloon: {
    id: 'balloon',
    name: 'Balon',
    tagline: 'Yavaş ve sakin',
    riskLabel: 'En düşük risk · düşük tavan',
    riskTone: 'calm',
    climbVisual: 0.55,
    multipliers: [1.1, 1.2, 1.35, 1.5, 1.7],
    multGrowthBase: 1.7,
    multGrowthFactor: 1.15,
    crashChances: [0.01, 0.02, 0.04, 0.06, 0.1],
    crashStep: 0.04,
    crashCap: 0.35,
    unlockCredits: 5,
    unlockScore: 8,
    defaultSkin: 'balloon-default',
  },
  kite: {
    id: 'kite',
    name: 'Uçurtma',
    tagline: 'Rüzgâr seni sürükler',
    riskLabel: 'Eğim şart · ani kopma riski',
    riskTone: 'wild',
    climbVisual: 0.85,
    multipliers: [1.15, 1.4, 1.8, 2.6, 4.0],
    multGrowthBase: 4,
    multGrowthFactor: 1.55,
    crashChances: [0.02, 0.04, 0.08, 0.14, 0.28],
    crashStep: 0.11,
    crashCap: 0.88,
    unlockCredits: 7,
    unlockScore: 12,
    defaultSkin: 'kite-default',
  },
  ufo: {
    id: 'ufo',
    name: 'UFO',
    tagline: 'Blöf LED · bir kaçış',
    riskLabel: 'Yalan sinyal · 1× faz kalkanı',
    riskTone: 'trick',
    climbVisual: 1.1,
    multipliers: [1.3, 1.7, 2.4, 3.8, 6.5],
    multGrowthBase: 6.5,
    multGrowthFactor: 1.75,
    crashChances: [0.03, 0.07, 0.13, 0.22, 0.36],
    crashStep: 0.1,
    crashCap: 0.9,
    unlockCredits: 14,
    unlockScore: 28,
    defaultSkin: 'ufo-default',
  },
  paper: {
    id: 'paper',
    name: 'Kağıt Uçak',
    tagline: 'Hafif · rüzgâr oyunu',
    riskLabel: 'Az düşer · ani yırtılma',
    riskTone: 'calm',
    climbVisual: 1.2,
    multipliers: [1.15, 1.35, 1.6, 2.0, 2.5],
    multGrowthBase: 2.5,
    multGrowthFactor: 1.3,
    crashChances: [0.015, 0.03, 0.05, 0.08, 0.12],
    crashStep: 0.06,
    crashCap: 0.7,
    unlockCredits: 6,
    unlockScore: 10,
    defaultSkin: 'paper-default',
  },
}

export const SKINS: Record<CraftSkinId, SkinDef> = {
  'drone-default': {
    id: 'drone-default',
    craftId: 'drone',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0x1a2332,
    accentColor: 0x7dd3fc,
  },
  'drone-gold': {
    id: 'drone-gold',
    craftId: 'drone',
    name: 'Altın Drone',
    rarity: 'legendary',
    unlockCredits: 10,
    requireBestX: 5,
    bodyColor: 0x3d2e0a,
    accentColor: 0xffd700,
    emissiveBoost: 0.35,
  },
  'plane-default': {
    id: 'plane-default',
    craftId: 'plane',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0xe8eef5,
    accentColor: 0x3b82c4,
  },
  'rocket-default': {
    id: 'rocket-default',
    craftId: 'rocket',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0xc4cad4,
    accentColor: 0xff6b35,
  },
  'rocket-night': {
    id: 'rocket-night',
    craftId: 'rocket',
    name: 'Gece Roketi',
    rarity: 'rare',
    unlockCredits: 15,
    requireStreak: 3,
    bodyColor: 0x0b1020,
    accentColor: 0x7c5cff,
    emissiveBoost: 0.55,
  },
  'balloon-default': {
    id: 'balloon-default',
    craftId: 'balloon',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0xff7a59,
    accentColor: 0xffd6a5,
  },
  'kite-default': {
    id: 'kite-default',
    craftId: 'kite',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0xff4d6a,
    accentColor: 0xffe08a,
  },
  'ufo-default': {
    id: 'ufo-default',
    craftId: 'ufo',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0x2a2f45,
    accentColor: 0xb8f54a,
    emissiveBoost: 0.4,
  },
  'paper-default': {
    id: 'paper-default',
    craftId: 'paper',
    name: 'Standart',
    rarity: 'common',
    unlockCredits: 0,
    bodyColor: 0xf5f0e6,
    accentColor: 0x7dd3fc,
  },
}

export const CRAFT_ORDER: CraftId[] = [
  'drone',
  'balloon',
  'paper',
  'plane',
  'kite',
  'rocket',
  'ufo',
]

export function skinsForCraft(craftId: CraftId): SkinDef[] {
  return Object.values(SKINS).filter((s) => s.craftId === craftId)
}

export function scorePoints(totalCashed: number): number {
  return Math.floor(totalCashed)
}
