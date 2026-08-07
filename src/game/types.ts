export type Screen =
  | 'home'
  | 'flight'
  | 'result'
  | 'leaderboard'
  | 'profile'
  | 'hangar'

export type FlightPhase = 'idle' | 'climbing' | 'landing' | 'crashing' | 'done'

export type LedLevel = 'safe' | 'caution' | 'critical'

export type Outcome = 'cashed' | 'crashed'

export type CraftId =
  | 'drone'
  | 'plane'
  | 'rocket'
  | 'balloon'
  | 'kite'
  | 'ufo'
  | 'paper'

export type CraftSkinId =
  | 'drone-default'
  | 'drone-gold'
  | 'plane-default'
  | 'rocket-default'
  | 'rocket-night'
  | 'balloon-default'
  | 'kite-default'
  | 'ufo-default'
  | 'paper-default'

export type RiskTone = 'calm' | 'safe' | 'balanced' | 'wild' | 'trick'

/** Extra flight rules beyond normal / daily challenge */
export type FlightMode = 'normal' | 'challenge' | 'blind'

export interface LayerInfo {
  layer: number
  multiplier: number
  crashChance: number
}

export interface FlightResult {
  outcome: Outcome
  layer: number
  multiplier: number
  nearMissMultiplier: number
  timestamp: number
  craftId: CraftId
  skinId: CraftSkinId
  bombUsed?: boolean
  /** Sky bonus fraction applied (e.g. 0.15 = +15%) */
  skyBonus?: number
  /** Daily challenge flight (seeded RNG) */
  challenge?: boolean
  /** Blind flight mode */
  blind?: boolean
  /** UFO phase shield absorbed a crash */
  ufoShieldUsed?: boolean
}

export interface DailyMission {
  id: string
  label: string
  target: number
  progress: number
  rewardFlights: number
  rewardBombs?: number
  completed: boolean
}

export interface PlayerProfile {
  displayName: string
  flights: number
  safeLandings: number
  crashes: number
  bestMultiplier: number
  bestLayer: number
  totalCashed: number
  streak: number
  lastFlightDate: string | null
  flightCredits: number
  bombs: number
  lastBombGrantDate: string | null
  badges: string[]
  history: FlightResult[]
  missions: DailyMission[]
  missionDate: string | null
  unlockedCrafts: CraftId[]
  unlockedSkins: CraftSkinId[]
  selectedCraft: CraftId
  selectedSkin: CraftSkinId
  /** Linked Phantom / Solana wallet */
  walletAddress: string | null
  walletVerified: boolean
}

export interface LeaderboardEntry {
  id: string
  name: string
  bestMultiplier: number
  bestLayer: number
  streak: number
  isYou?: boolean
}
