/** Compact profile sync via Telegram CloudStorage (≤4096 bytes). */

import WebApp from '@twa-dev/sdk'
import { isTelegramMiniApp } from './webApp'
import type { PlayerProfile } from '../game/types'
import { normalizeBalances } from '../game/assets'

const KEY = 'zd_cloud_v1'

export interface CloudBlob {
  v: 1
  name: string
  streak: number
  credits: number
  bombs: number
  bestM: number
  bestL: number
  badges: string[]
  usdc: number
  usdt: number
  t: number
}

export function toCloudBlob(profile: PlayerProfile): CloudBlob {
  const bal = normalizeBalances(profile.balances)
  return {
    v: 1,
    name: profile.displayName.slice(0, 16),
    streak: profile.streak,
    credits: profile.flightCredits,
    bombs: profile.bombs ?? 0,
    bestM: profile.bestMultiplier,
    bestL: profile.bestLayer,
    badges: profile.badges.slice(0, 40),
    usdc: bal.usdc,
    usdt: bal.usdt,
    t: Date.now(),
  }
}

export function mergeCloudBlob(
  profile: PlayerProfile,
  blob: CloudBlob,
): PlayerProfile {
  if (blob.v !== 1) return profile
  const bal = normalizeBalances(profile.balances)
  const badges = Array.from(new Set([...profile.badges, ...blob.badges]))
  return {
    ...profile,
    displayName:
      profile.displayName === 'Pilot' && blob.name
        ? blob.name
        : profile.displayName,
    streak: Math.max(profile.streak, blob.streak),
    flightCredits: Math.max(profile.flightCredits, blob.credits),
    bombs: Math.max(profile.bombs ?? 0, blob.bombs),
    bestMultiplier: Math.max(profile.bestMultiplier, blob.bestM),
    bestLayer: Math.max(profile.bestLayer, blob.bestL),
    badges,
    balances: {
      ...bal,
      usdc: Math.max(bal.usdc, blob.usdc),
      usdt: Math.max(bal.usdt, blob.usdt),
    },
  }
}

function cloudEnabled(): boolean {
  return (
    isTelegramMiniApp() &&
    typeof WebApp.CloudStorage?.getItem === 'function' &&
    typeof WebApp.CloudStorage?.setItem === 'function'
  )
}

export function pullCloudProfile(): Promise<CloudBlob | null> {
  if (!cloudEnabled()) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      WebApp.CloudStorage.getItem(KEY, (err, value) => {
        if (err || !value) {
          resolve(null)
          return
        }
        try {
          const parsed = JSON.parse(value) as CloudBlob
          resolve(parsed?.v === 1 ? parsed : null)
        } catch {
          resolve(null)
        }
      })
    } catch {
      resolve(null)
    }
  })
}

export function pushCloudProfile(profile: PlayerProfile): Promise<boolean> {
  if (!cloudEnabled()) return Promise.resolve(false)
  const json = JSON.stringify(toCloudBlob(profile))
  if (json.length > 4000) return Promise.resolve(false)
  return new Promise((resolve) => {
    try {
      WebApp.CloudStorage.setItem(KEY, json, (err, ok) => {
        resolve(!err && Boolean(ok))
      })
    } catch {
      resolve(false)
    }
  })
}
