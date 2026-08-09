import { describe, expect, it, beforeEach } from 'vitest'
import { ASSETS, emptyBalances } from './assets'
import {
  calcWithdrawFee,
  cancelWithdraw,
  creditOnChainDeposit,
  queueWithdraw,
} from './withdrawQueue'
import type { PlayerProfile } from './types'

function base(over: Partial<PlayerProfile> = {}): PlayerProfile {
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
    flightCredits: 10,
    bombs: 0,
    lastBombGrantDate: null,
    badges: [],
    history: [],
    missions: [],
    missionDate: null,
    unlockedCrafts: ['drone'],
    unlockedSkins: ['drone-default'],
    selectedCraft: 'drone',
    selectedSkin: 'drone-default',
    walletAddress: 'So11111111111111111111111111111111111111112',
    walletVerified: true,
    balances: { ...emptyBalances(), sol: 1, usdt: 100, usdc: 10 },
    payAsset: 'usdc',
    payWithCrypto: true,
    stakeAmount: 1,
    demoPackClaimed: true,
    instantUsdcClaimed: true,
    highRoller: false,
    autoCashOut: 0,
    checkInDate: null,
    checkInStreak: 0,
    referredBy: null,
    referralClaimed: false,
    friendMilestonesClaimed: [],
    starsBalance: 0,
    payWithStars: false,
    starsWelcomeClaimed: false,
    ...over,
  }
}

describe('withdrawQueue USDC settlement', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('converts USDT withdraw to USDC net', () => {
    const { fee, net, usdcGross } = calcWithdrawFee('usdt', 10)
    expect(usdcGross).toBe(10)
    expect(fee).toBeGreaterThan(0)
    expect(net).toBe(10 - fee)
  })

  it('queues withdraw settled in USDC', () => {
    const p = base()
    const q = queueWithdraw(p, 'usdt', 10, 'So11111111111111111111111111111111111111112')
    expect(q.ok).toBe(true)
    if (!q.ok) return
    expect(q.balances.usdt).toBe(90)
    expect(q.request.asset).toBe('usdc')
    expect(q.request.net).toBeLessThan(10)
    const next = { ...p, balances: q.balances }
    const c = cancelWithdraw(next, q.request.id)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.balances.usdt).toBe(100)
  })

  it('credits on-chain USDC deposit', () => {
    const p = base({ balances: emptyBalances() })
    const res = creditOnChainDeposit(p, 5, 'sig123456789abcdef', 'usdc')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.balances.usdc).toBe(5)
  })

  it('converts SOL to USDC for withdraw', () => {
    const p = base()
    const q = queueWithdraw(p, 'sol', 0.1, 'So11111111111111111111111111111111111111112')
    expect(q.ok).toBe(true)
    if (!q.ok) return
    expect(q.request.asset).toBe('usdc')
    expect(q.request.amount).toBeGreaterThan(1)
  })
})

void ASSETS
