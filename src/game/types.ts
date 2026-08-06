export type Screen = 'home' | 'flight' | 'result' | 'leaderboard' | 'profile'

export type FlightPhase = 'idle' | 'climbing' | 'landing' | 'crashing' | 'done'

export type LedLevel = 'safe' | 'caution' | 'critical'

export type Outcome = 'cashed' | 'crashed'

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
}

export interface DailyMission {
  id: string
  label: string
  target: number
  progress: number
  rewardFlights: number
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
  badges: string[]
  history: FlightResult[]
  missions: DailyMission[]
  missionDate: string | null
}

export interface LeaderboardEntry {
  id: string
  name: string
  bestMultiplier: number
  bestLayer: number
  streak: number
  isYou?: boolean
}
