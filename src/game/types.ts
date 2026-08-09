export type Screen =
  | 'home'
  | 'flight'
  | 'result'
  | 'leaderboard'
  | 'profile'
  | 'hangar'
  | 'wallet'

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
  stakeAsset?: import('./assets').AssetId
  stakeAmount?: number
  payoutAmount?: number
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
  /** Multi-asset play balances */
  balances: import('./assets').AssetBalances
  /** Asset used to stake flights */
  payAsset: import('./assets').AssetId
  /** Prefer crypto stake over free pil when possible */
  payWithCrypto: boolean
  /** Selected stake amount in payAsset units */
  stakeAmount: number
  demoPackClaimed: boolean
  /** Instant 10 USDC welcome credited */
  instantUsdcClaimed: boolean
  /** Allow SOL/ETH/BTC stakes (off = stable USDT/USDC only) */
  highRoller: boolean
  /** Auto cash-out target multiplier; 0 = off */
  autoCashOut: number
  /** Last daily check-in date YYYY-MM-DD */
  checkInDate: string | null
  checkInStreak: number
  /** Pilot id who invited this player */
  referredBy: string | null
  referralClaimed: boolean
  /** Friend-count milestones already paid */
  friendMilestonesClaimed: number[]
}

export interface LeaderboardEntry {
  id: string
  name: string
  bestMultiplier: number
  bestLayer: number
  streak: number
  isYou?: boolean
}
