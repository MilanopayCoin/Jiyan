import { todayKey, yesterdayKey } from './math'
import { normalizeBalances, roundAsset, type AssetBalances } from './assets'
import type { PlayerProfile } from './types'

export interface CheckInReward {
  day: number
  credits: number
  bombs: number
  usdt: number
  label: string
}

/** 7-day rotating check-in ladder */
export const CHECKIN_REWARDS: CheckInReward[] = [
  { day: 1, credits: 2, bombs: 0, usdt: 0, label: '2 pil' },
  { day: 2, credits: 3, bombs: 0, usdt: 1, label: '3 pil + 1 USDT' },
  { day: 3, credits: 2, bombs: 1, usdt: 0, label: '2 pil + 1 bomba' },
  { day: 4, credits: 4, bombs: 0, usdt: 2, label: '4 pil + 2 USDT' },
  { day: 5, credits: 3, bombs: 0, usdt: 3, label: '3 pil + 3 USDT' },
  { day: 6, credits: 5, bombs: 0, usdt: 5, label: '5 pil + 5 USDT' },
  { day: 7, credits: 8, bombs: 1, usdt: 10, label: '8 pil + 10 USDT + bomba' },
]

export const AUTO_CASH_PRESETS = [0, 1.5, 2, 3, 5, 8] as const

export const REFERRAL_JOIN_USDT = 5
export const REFERRAL_JOIN_CREDITS = 3

export const FRIEND_MILESTONES: { count: number; credits: number; usdt: number }[] = [
  { count: 1, credits: 2, usdt: 1 },
  { count: 3, credits: 4, usdt: 3 },
  { count: 5, credits: 6, usdt: 5 },
]

export type RetentionResult =
  | { ok: true; profile: PlayerProfile; message: string }
  | { ok: false; error: string }

export function nextCheckInDay(streak: number, lastDate: string | null): number {
  const today = todayKey()
  if (lastDate === today) return ((streak - 1) % 7) + 1
  if (lastDate === yesterdayKey()) return (streak % 7) + 1
  return 1
}

export function canCheckIn(profile: PlayerProfile): boolean {
  return profile.checkInDate !== todayKey()
}

export function previewCheckIn(profile: PlayerProfile): CheckInReward {
  const day = nextCheckInDay(profile.checkInStreak, profile.checkInDate)
  return CHECKIN_REWARDS[day - 1]!
}

export function claimCheckIn(profile: PlayerProfile): RetentionResult {
  if (!canCheckIn(profile)) {
    return { ok: false, error: 'Bugünkü check-in alındı' }
  }
  const today = todayKey()
  const yesterday = yesterdayKey()
  let streak = 1
  if (profile.checkInDate === yesterday) {
    streak = profile.checkInStreak + 1
  }
  const dayIndex = ((streak - 1) % 7)
  const reward = CHECKIN_REWARDS[dayIndex]!
  const balances = normalizeBalances(profile.balances)
  if (reward.usdt > 0) {
    balances.usdt = roundAsset(balances.usdt + reward.usdt, 'usdt')
  }
  const badges = new Set(profile.badges)
  badges.add('checkin-pilot')
  if (streak >= 7) badges.add('checkin-7')

  const next: PlayerProfile = {
    ...profile,
    flightCredits: profile.flightCredits + reward.credits,
    bombs: Math.min(5, (profile.bombs ?? 0) + reward.bombs),
    balances,
    checkInDate: today,
    checkInStreak: streak,
    badges: Array.from(badges),
  }
  return {
    ok: true,
    profile: next,
    message: `Gün ${reward.day}: ${reward.label} · seri ${streak}`,
  }
}

/** First-time join via invite link */
export function claimReferralJoin(
  profile: PlayerProfile,
  referrerId: string,
): RetentionResult {
  if (profile.referralClaimed) {
    return { ok: false, error: 'Davet ödülü zaten alındı' }
  }
  if (!referrerId || referrerId.length < 4) {
    return { ok: false, error: 'Geçersiz davet' }
  }
  const balances = normalizeBalances(profile.balances)
  balances.usdt = roundAsset(balances.usdt + REFERRAL_JOIN_USDT, 'usdt')
  const badges = new Set(profile.badges)
  badges.add('davet-geldi')

  const next: PlayerProfile = {
    ...profile,
    flightCredits: profile.flightCredits + REFERRAL_JOIN_CREDITS,
    balances,
    referredBy: referrerId.slice(0, 24),
    referralClaimed: true,
    badges: Array.from(badges),
  }
  return {
    ok: true,
    profile: next,
    message: `Davet ödülü: +${REFERRAL_JOIN_CREDITS} pil + ${REFERRAL_JOIN_USDT} USDT`,
  }
}

/** Referrer milestones based on friend count */
export function claimFriendMilestones(
  profile: PlayerProfile,
  friendCount: number,
): RetentionResult | null {
  const claimed = new Set(profile.friendMilestonesClaimed ?? [])
  let balances = normalizeBalances(profile.balances)
  let credits = profile.flightCredits
  let gained = false
  const messages: string[] = []
  const nextClaimed = [...claimed]

  for (const m of FRIEND_MILESTONES) {
    if (friendCount < m.count) continue
    if (claimed.has(m.count)) continue
    credits += m.credits
    balances = {
      ...balances,
      usdt: roundAsset(balances.usdt + m.usdt, 'usdt'),
    }
    nextClaimed.push(m.count)
    messages.push(`${m.count} arkadaş: +${m.credits} pil + ${m.usdt} USDT`)
    gained = true
  }

  if (!gained) return null

  const badges = new Set(profile.badges)
  badges.add('sosyal-pilot')
  if (friendCount >= 5) badges.add('filo-davet')

  return {
    ok: true,
    profile: {
      ...profile,
      flightCredits: credits,
      balances,
      friendMilestonesClaimed: nextClaimed.sort((a, b) => a - b),
      badges: Array.from(badges),
    },
    message: messages.join(' · '),
  }
}

export function formatAutoCash(x: number): string {
  if (x <= 0) return 'Kapalı'
  return `${x}x`
}

/** Rough USD hint for stake display (demo rates) */
export const DEMO_USD: Record<keyof AssetBalances, number> = {
  usdt: 1,
  usdc: 1,
  eth: 3200,
  sol: 140,
  btc: 95_000,
}

export function approxUsd(amount: number, asset: keyof AssetBalances): string {
  const usd = amount * (DEMO_USD[asset] ?? 0)
  if (usd < 0.01) return '<$0.01'
  if (usd < 10) return `≈$${usd.toFixed(2)}`
  return `≈$${Math.round(usd)}`
}

export function defaultAutoCashOut(): number {
  return 0
}