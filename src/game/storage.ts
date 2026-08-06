import type { DailyMission, FlightResult, LeaderboardEntry, PlayerProfile } from './types'
import { todayKey, yesterdayKey } from './math'

const STORAGE_KEY = 'zincir-drone-profile-v1'

const DEFAULT_MISSIONS: Omit<DailyMission, 'progress' | 'completed'>[] = [
  { id: 'flights3', label: '3 uçuş yap', target: 3, rewardFlights: 1 },
  { id: 'reach5x', label: "5x irtifayı geç", target: 1, rewardFlights: 1 },
  { id: 'safe2', label: 'Arka arkaya 2 güvenli iniş', target: 2, rewardFlights: 2 },
]

function freshMissions(): DailyMission[] {
  return DEFAULT_MISSIONS.map((m) => ({
    ...m,
    progress: 0,
    completed: false,
  }))
}

export function defaultProfile(): PlayerProfile {
  return {
    displayName: 'Pilot',
    flights: 0,
    safeLandings: 0,
    crashes: 0,
    bestMultiplier: 0,
    bestLayer: 0,
    totalCashed: 0,
    streak: 0,
    lastFlightDate: null,
    flightCredits: 12,
    badges: ['yeni-pilot'],
    history: [],
    missions: freshMissions(),
    missionDate: todayKey(),
  }
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProfile()
    const parsed = JSON.parse(raw) as PlayerProfile
    return reconcileStreakAndMissions(parsed)
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

function reconcileStreakAndMissions(profile: PlayerProfile): PlayerProfile {
  const today = todayKey()
  const yesterday = yesterdayKey()
  let next = { ...profile }

  // Streak break if last flight older than yesterday
  if (next.lastFlightDate && next.lastFlightDate !== today && next.lastFlightDate !== yesterday) {
    if (next.streak > 0) {
      next = {
        ...next,
        streak: 0,
        badges: next.badges.filter((b) => b !== 'seri-ustasi'),
      }
    }
  }

  if (next.missionDate !== today) {
    next = {
      ...next,
      missions: freshMissions(),
      missionDate: today,
    }
  }

  return next
}

export function applyFlightResult(
  profile: PlayerProfile,
  result: FlightResult,
  consecutiveSafe: number,
): { profile: PlayerProfile; consecutiveSafe: number } {
  const today = todayKey()
  let streak = profile.streak
  if (profile.lastFlightDate !== today) {
    if (profile.lastFlightDate === yesterdayKey()) streak += 1
    else streak = 1
  }

  let consecutive = consecutiveSafe
  if (result.outcome === 'cashed') consecutive += 1
  else consecutive = 0

  const badges = new Set(profile.badges)
  if (streak >= 7) badges.add('seri-ustasi')
  if (result.multiplier >= 5) badges.add('irtifa-5')
  if (result.multiplier >= 10) badges.add('irtifa-10')
  if (result.layer >= 8) badges.add('gokyuzu-avcisi')
  if (profile.flights + 1 >= 20) badges.add('filo-komutani')

  let missions = profile.missions.map((m) => ({ ...m }))
  // Credit already spent on takeoff; only award mission bonuses here
  let credits = profile.flightCredits

  // Update missions
  missions = missions.map((m) => {
    if (m.completed) return m
    let progress = m.progress
    if (m.id === 'flights3') progress += 1
    if (m.id === 'reach5x' && result.multiplier >= 5) progress = 1
    if (m.id === 'safe2') {
      progress = consecutive
    }
    const completed = progress >= m.target
    return { ...m, progress: Math.min(progress, m.target), completed }
  })

  // Award newly completed missions
  for (let i = 0; i < missions.length; i++) {
    const before = profile.missions[i]
    const after = missions[i]
    if (after.completed && !before.completed) {
      credits += after.rewardFlights
      badges.add(`gorev-${after.id}`)
    }
  }

  const next: PlayerProfile = {
    ...profile,
    flights: profile.flights + 1,
    safeLandings:
      profile.safeLandings + (result.outcome === 'cashed' ? 1 : 0),
    crashes: profile.crashes + (result.outcome === 'crashed' ? 1 : 0),
    bestMultiplier: Math.max(profile.bestMultiplier, result.multiplier),
    bestLayer: Math.max(profile.bestLayer, result.layer),
    totalCashed:
      profile.totalCashed +
      (result.outcome === 'cashed' ? result.multiplier : 0),
    streak,
    lastFlightDate: today,
    flightCredits: credits,
    badges: Array.from(badges),
    history: [result, ...profile.history].slice(0, 40),
    missions,
    missionDate: today,
  }

  saveProfile(next)
  return { profile: next, consecutiveSafe: consecutive }
}

const BOT_NAMES = [
  'Ahmet',
  'Elif',
  'Can',
  'Zeynep',
  'Mert',
  'Deniz',
  'Yağmur',
  'Kerem',
  'Selin',
  'Emre',
]

export function buildLeaderboard(profile: PlayerProfile): LeaderboardEntry[] {
  const bots: LeaderboardEntry[] = BOT_NAMES.map((name, i) => {
    const seed = name.length * 17 + i * 3
    const bestLayer = 3 + (seed % 10)
    const mults = [1.5, 2, 3, 5, 8, 12.8, 20.48, 4.5, 7.2, 15]
    return {
      id: `bot-${i}`,
      name,
      bestMultiplier: mults[i % mults.length],
      bestLayer,
      streak: 1 + (seed % 14),
    }
  })

  const you: LeaderboardEntry = {
    id: 'you',
    name: `${profile.displayName} (Sen)`,
    bestMultiplier: profile.bestMultiplier || 0,
    bestLayer: profile.bestLayer || 0,
    streak: profile.streak,
    isYou: true,
  }

  return [...bots, you].sort((a, b) => b.bestMultiplier - a.bestMultiplier)
}

export const BADGE_LABELS: Record<string, string> = {
  'yeni-pilot': 'Yeni Pilot',
  'seri-ustasi': 'Seri Ustası',
  'irtifa-5': '5x İrtifa',
  'irtifa-10': '10x İrtifa',
  'gokyuzu-avcisi': 'Gökyüzü Avcısı',
  'filo-komutani': 'Filo Komutanı',
  'gorev-flights3': 'Görev: 3 Uçuş',
  'gorev-reach5x': 'Görev: 5x',
  'gorev-safe2': 'Görev: Güvenli İniş',
}
