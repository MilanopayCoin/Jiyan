/** Filo düellosu — shared seed flight between two pilots. */

import { telegramBotUsername } from './webApp'
import { makeDuelStartParam } from './startParams'
import { todayKey } from '../game/math'

const API = (import.meta.env.VITE_SYNC_API as string | undefined) || '/api'

export interface DuelScore {
  pilotId: string
  name: string
  multiplier: number
  layer: number
  outcome: 'cashed' | 'crashed'
  at: number
}

export interface DuelState {
  id: string
  scores: DuelScore[]
}

export function newDuelId(): string {
  return `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

export function duelSeed(duelId: string, craftId: string): string {
  return `zincir-duel-${duelId}-${craftId}`
}

export function duelInviteUrl(duelId: string): string | null {
  const bot = telegramBotUsername()
  if (!bot) {
    // Fallback to web query
    const origin =
      typeof location !== 'undefined'
        ? location.origin + location.pathname
        : 'https://chaindrone.netlify.app/'
    const base = origin.endsWith('/') ? origin : `${origin}/`
    return `${base}?duel=${encodeURIComponent(duelId)}`
  }
  return `https://t.me/${bot}?startapp=${makeDuelStartParam(duelId)}`
}

export async function pushDuelScore(
  duelId: string,
  score: DuelScore,
): Promise<DuelState | null> {
  try {
    const res = await fetch(`${API}/duel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duelId, ...score, dayKey: todayKey() }),
    })
    if (!res.ok) return null
    return (await res.json()) as DuelState
  } catch {
    return null
  }
}

export async function fetchDuel(duelId: string): Promise<DuelState | null> {
  try {
    const res = await fetch(
      `${API}/duel?id=${encodeURIComponent(duelId)}`,
    )
    if (!res.ok) return null
    return (await res.json()) as DuelState
  } catch {
    return null
  }
}

export function duelVerdict(
  me: DuelScore,
  other: DuelScore | undefined,
): string {
  if (!other) return 'Rakip henüz uçmadı — linki paylaş'
  if (me.outcome === 'crashed' && other.outcome === 'crashed') {
    return me.layer === other.layer
      ? 'Berabere düşüş'
      : me.layer > other.layer
        ? 'Daha uzağa gittin (düşüş)'
        : 'Rakip daha uzağa gitti'
  }
  if (me.outcome === 'cashed' && other.outcome !== 'cashed') return 'Kazandın!'
  if (me.outcome !== 'cashed' && other.outcome === 'cashed') return 'Rakip indirdi'
  if (me.multiplier === other.multiplier) return 'Berabere!'
  return me.multiplier > other.multiplier ? 'Kazandın!' : 'Kaybettin'
}
