import type {
  CraftId,
  CraftSkinId,
  DailyMission,
  FlightResult,
  LeaderboardEntry,
  PlayerProfile,
} from './types'
import { todayKey, yesterdayKey } from './math'
import { CRAFTS, SKINS, scorePoints } from './vehicles'
import {
  INSTANT_USDC_CREDIT,
  emptyBalances,
  isAssetId,
  normalizeBalances,
  roundAsset,
  type AssetId,
} from './assets'
import {
  clampPlayAsset,
  defaultStakeFor,
  isStableAsset,
} from './stableEconomy'

const STORAGE_KEY = 'zincir-drone-profile-v2'
const LEGACY_KEY = 'zincir-drone-profile-v1'

const DEFAULT_MISSIONS: Omit<DailyMission, 'progress' | 'completed'>[] = [
  { id: 'flights3', label: '3 uçuş yap', target: 3, rewardUsdt: 1 },
  { id: 'reach5x', label: '5x irtifayı geç', target: 1, rewardUsdt: 1, rewardBombs: 1 },
  { id: 'safe2', label: 'Arka arkaya 2 güvenli iniş', target: 2, rewardUsdt: 2 },
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
    flightCredits: 0,
    bombs: 1,
    lastBombGrantDate: todayKey(),
    badges: ['yeni-pilot'],
    history: [],
    missions: freshMissions(),
    missionDate: todayKey(),
    unlockedCrafts: ['drone'],
    unlockedSkins: ['drone-default'],
    selectedCraft: 'drone',
    selectedSkin: 'drone-default',
    walletAddress: null,
    walletVerified: false,
    balances: emptyBalances(),
    payAsset: 'usdc',
    payWithCrypto: true,
    stakeAmount: 1,
    demoPackClaimed: false,
    instantUsdcClaimed: false,
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
  }
}

function migrateProfile(raw: Partial<PlayerProfile> & Record<string, unknown>): PlayerProfile {
  const base = defaultProfile()
  const history = Array.isArray(raw.history)
    ? (raw.history as FlightResult[]).map((h) => ({
        ...h,
        craftId: h.craftId ?? 'drone',
        skinId: h.skinId ?? 'drone-default',
      }))
    : []

  const unlockedCrafts = Array.isArray(raw.unlockedCrafts)
    ? (raw.unlockedCrafts as CraftId[])
    : ['drone']
  if (!unlockedCrafts.includes('drone')) unlockedCrafts.unshift('drone')

  const unlockedSkins = Array.isArray(raw.unlockedSkins)
    ? (raw.unlockedSkins as CraftSkinId[])
    : ['drone-default']
  if (!unlockedSkins.includes('drone-default')) unlockedSkins.push('drone-default')

  const selectedCraft = (raw.selectedCraft as CraftId) || 'drone'
  let selectedSkin = (raw.selectedSkin as CraftSkinId) || CRAFTS[selectedCraft].defaultSkin
  if (SKINS[selectedSkin]?.craftId !== selectedCraft) {
    selectedSkin = CRAFTS[selectedCraft].defaultSkin
  }

  return {
    ...base,
    ...raw,
    bombs: typeof raw.bombs === 'number' ? raw.bombs : base.bombs,
    lastBombGrantDate:
      typeof raw.lastBombGrantDate === 'string' || raw.lastBombGrantDate === null
        ? (raw.lastBombGrantDate as string | null)
        : base.lastBombGrantDate,
    history,
    unlockedCrafts: Array.from(new Set(unlockedCrafts)) as CraftId[],
    unlockedSkins: Array.from(new Set(unlockedSkins)) as CraftSkinId[],
    selectedCraft: unlockedCrafts.includes(selectedCraft) ? selectedCraft : 'drone',
    selectedSkin: unlockedSkins.includes(selectedSkin)
      ? selectedSkin
      : CRAFTS.drone.defaultSkin,
    missions: Array.isArray(raw.missions) ? (raw.missions as DailyMission[]) : base.missions,
    badges: Array.isArray(raw.badges) ? (raw.badges as string[]) : base.badges,
    walletAddress:
      typeof raw.walletAddress === 'string' ? raw.walletAddress : null,
    walletVerified: Boolean(raw.walletVerified),
    balances: normalizeBalances(raw.balances),
    payWithCrypto: raw.payWithCrypto !== false,
    highRoller: Boolean(raw.highRoller),
    instantUsdcClaimed: Boolean(raw.instantUsdcClaimed),
    payAsset: (() => {
      const high = Boolean(raw.highRoller)
      const rawAsset = isAssetId(raw.payAsset) ? (raw.payAsset as AssetId) : 'usdc'
      return clampPlayAsset(rawAsset, high)
    })(),
    stakeAmount: (() => {
      const high = Boolean(raw.highRoller)
      const asset = clampPlayAsset(
        isAssetId(raw.payAsset) ? (raw.payAsset as AssetId) : 'usdc',
        high,
      )
      const n = Number(raw.stakeAmount)
      if (Number.isFinite(n) && n > 0) return roundAsset(n, asset)
      return defaultStakeFor(asset, high)
    })(),
    demoPackClaimed: Boolean(raw.demoPackClaimed),
    autoCashOut: (() => {
      const n = Number(raw.autoCashOut)
      return Number.isFinite(n) && n >= 0 ? n : 0
    })(),
    checkInDate:
      typeof raw.checkInDate === 'string' || raw.checkInDate === null
        ? (raw.checkInDate as string | null)
        : null,
    checkInStreak:
      typeof raw.checkInStreak === 'number' && raw.checkInStreak >= 0
        ? Math.floor(raw.checkInStreak)
        : 0,
    referredBy: typeof raw.referredBy === 'string' ? raw.referredBy : null,
    referralClaimed: Boolean(raw.referralClaimed),
    friendMilestonesClaimed: Array.isArray(raw.friendMilestonesClaimed)
      ? (raw.friendMilestonesClaimed as number[]).filter((n) => typeof n === 'number')
      : [],
    starsBalance:
      typeof raw.starsBalance === 'number' && raw.starsBalance >= 0
        ? Math.floor(raw.starsBalance)
        : 0,
    payWithStars: Boolean(raw.payWithStars),
    starsWelcomeClaimed: Boolean(raw.starsWelcomeClaimed),
  }
}

/** Grant 10 USDC once on first load if never claimed */
export function ensureInstantUsdc(profile: PlayerProfile): PlayerProfile {
  if (profile.instantUsdcClaimed) return profile
  const balances = normalizeBalances(profile.balances)
  balances.usdc = roundAsset(balances.usdc + INSTANT_USDC_CREDIT, 'usdc')
  const next: PlayerProfile = {
    ...profile,
    balances,
    instantUsdcClaimed: true,
    payAsset: isStableAsset(profile.payAsset) ? profile.payAsset : 'usdc',
    badges: profile.badges.includes('usdc-hosgeldin')
      ? profile.badges
      : [...profile.badges, 'usdc-hosgeldin'],
  }
  saveProfile(next)
  return next
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      const fresh = defaultProfile()
      return ensureInstantUsdc(fresh)
    }
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>
    const migrated = migrateProfile(parsed)
    const withUsdc = ensureInstantUsdc(migrated)
    const reconciled = reconcileStreakAndMissions(withUsdc)
    saveProfile(reconciled)
    return reconciled
  } catch {
    return ensureInstantUsdc(defaultProfile())
  }
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

function reconcileStreakAndMissions(profile: PlayerProfile): PlayerProfile {
  const today = todayKey()
  const yesterday = yesterdayKey()
  let next = { ...profile }

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

  // Daily free signal bomb (cap 5)
  if (next.lastBombGrantDate !== today) {
    next = {
      ...next,
      bombs: Math.min(5, (next.bombs ?? 0) + 1),
      lastBombGrantDate: today,
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
  if (result.craftId === 'rocket' && result.outcome === 'cashed' && result.multiplier >= 7) {
    badges.add('roket-pilotu')
  }
  if (result.skinId === 'drone-gold' || result.skinId === 'rocket-night') {
    badges.add('nadir-filo')
  }

  let missions = profile.missions.map((m) => ({ ...m }))
  let bombs = profile.bombs ?? 0
  let balances = normalizeBalances(profile.balances)

  missions = missions.map((m) => {
    if (m.completed) return m
    let progress = m.progress
    if (m.id === 'flights3') progress += 1
    if (m.id === 'reach5x' && result.multiplier >= 5) progress = 1
    if (m.id === 'safe2') progress = consecutive
    const completed = progress >= m.target
    return { ...m, progress: Math.min(progress, m.target), completed }
  })

  for (let i = 0; i < missions.length; i++) {
    const before = profile.missions[i]
    const after = missions[i]
    if (after.completed && !before.completed) {
      const usdt =
        after.rewardUsdt ??
        (typeof after.rewardFlights === 'number' ? after.rewardFlights : 0)
      if (usdt > 0) {
        balances = {
          ...balances,
          usdt: roundAsset(balances.usdt + usdt, 'usdt'),
        }
      }
      bombs = Math.min(5, bombs + (after.rewardBombs ?? 0))
      badges.add(`gorev-${after.id}`)
    }
  }

  if (result.bombUsed) badges.add('sinyal-bombasi')
  if (result.skyBonus && result.skyBonus >= 0.1 && result.outcome === 'cashed') {
    badges.add('gokyuzu-pilotu')
  }
  if (result.blind && result.outcome === 'cashed' && result.layer >= 4) {
    badges.add('kor-pilot')
  }
  if (result.ufoShieldUsed) badges.add('ufo-kacis')
  if (result.eyeShieldUsed) badges.add('goz-kalkani')
  if (result.smileCashOut && result.outcome === 'cashed') {
    badges.add('gulumseme-inis')
  }
  if (result.selfieCaptured && result.outcome === 'cashed') {
    badges.add('selfie-pilot')
  }
  if (result.duelId) badges.add('filo-duello')
  if (result.chatBlind && result.outcome === 'cashed') badges.add('chat-kor')
  if (result.boostTable) badges.add('boost-masa')
  if (result.starsStake && result.starsStake > 0) badges.add('stars-pilot')
  if ((result.windCatches ?? 0) >= 3) badges.add('ruzgar-ustasi')
  if (result.weekly && result.outcome === 'cashed') badges.add('sezon-pilot')
  if (result.craftId === 'kite' && result.outcome === 'cashed' && result.layer >= 5) {
    badges.add('arac-kite')
  }

  // Boost table cashback on safe landing
  if (result.boostTable && result.outcome === 'cashed') {
    balances = {
      ...balances,
      usdc: roundAsset(balances.usdc + 0.5, 'usdc'),
    }
  }

  // Auto-unlock milestone skins (no spend) when requirements met
  const unlockedSkins = new Set(profile.unlockedSkins)
  const bestMult = Math.max(profile.bestMultiplier, result.multiplier)
  for (const skin of Object.values(SKINS)) {
    if (unlockedSkins.has(skin.id)) continue
    if (skin.requireBestX && bestMult >= skin.requireBestX) unlockedSkins.add(skin.id)
    if (skin.requireStreak && streak >= skin.requireStreak) unlockedSkins.add(skin.id)
  }

  const next: PlayerProfile = {
    ...profile,
    flights: profile.flights + 1,
    safeLandings: profile.safeLandings + (result.outcome === 'cashed' ? 1 : 0),
    crashes: profile.crashes + (result.outcome === 'crashed' ? 1 : 0),
    bestMultiplier: bestMult,
    bestLayer: Math.max(profile.bestLayer, result.layer),
    totalCashed:
      profile.totalCashed + (result.outcome === 'cashed' ? result.multiplier : 0),
    streak,
    lastFlightDate: today,
    flightCredits: profile.flightCredits,
    bombs,
    badges: Array.from(badges),
    history: [result, ...profile.history].slice(0, 40),
    missions,
    missionDate: today,
    unlockedSkins: Array.from(unlockedSkins) as CraftSkinId[],
    balances,
  }

  saveProfile(next)
  return { profile: next, consecutiveSafe: consecutive }
}

/** Points (floor of totalCashed) to buy one signal bomb */
export const BOMB_POINT_COST = 3
/** @deprecated use BOMB_POINT_COST — pil removed */
export const BOMB_CREDIT_COST = BOMB_POINT_COST

export function buyBomb(
  profile: PlayerProfile,
): { ok: true; profile: PlayerProfile } | { ok: false; reason: string } {
  if ((profile.bombs ?? 0) >= 5) {
    return { ok: false, reason: 'Bomba stoğu dolu (max 5)' }
  }
  const pts = scorePoints(profile.totalCashed)
  if (pts < BOMB_POINT_COST) {
    return { ok: false, reason: `${BOMB_POINT_COST} puan gerekli (şimdi ${pts})` }
  }
  const next: PlayerProfile = {
    ...profile,
    totalCashed: Math.max(0, profile.totalCashed - BOMB_POINT_COST),
    bombs: (profile.bombs ?? 0) + 1,
  }
  saveProfile(next)
  return { ok: true, profile: next }
}

export type UnlockPayWith = 'credits' | 'points'

export function unlockCraft(
  profile: PlayerProfile,
  craftId: CraftId,
  payWith: UnlockPayWith,
): { ok: true; profile: PlayerProfile } | { ok: false; reason: string } {
  if (profile.unlockedCrafts.includes(craftId)) {
    return { ok: false, reason: 'Zaten açık' }
  }
  const craft = CRAFTS[craftId]
  if (!craft) return { ok: false, reason: 'Bilinmeyen araç' }

  if (craft.unlockCredits === 0 && craft.unlockScore === 0) {
    const next = {
      ...profile,
      unlockedCrafts: [...profile.unlockedCrafts, craftId],
      unlockedSkins: profile.unlockedSkins.includes(craft.defaultSkin)
        ? profile.unlockedSkins
        : [...profile.unlockedSkins, craft.defaultSkin],
    }
    saveProfile(next)
    return { ok: true, profile: next }
  }

  if (payWith === 'credits') {
    // Pil removed — credit path redirects to points using unlockScore or unlockCredits as cost
    payWith = 'points'
  }

  const pts = scorePoints(profile.totalCashed)
  const pointCost =
    craft.unlockScore > 0 ? craft.unlockScore : craft.unlockCredits
  if (pts < pointCost) {
    return { ok: false, reason: `En az ${pointCost} puan gerekli (şimdi ${pts})` }
  }
  // Spending points: reduce totalCashed by cost (keeps lifetime feel via badges)
  const next: PlayerProfile = {
    ...profile,
    totalCashed: Math.max(0, profile.totalCashed - pointCost),
    unlockedCrafts: [...profile.unlockedCrafts, craftId],
    unlockedSkins: profile.unlockedSkins.includes(craft.defaultSkin)
      ? profile.unlockedSkins
      : [...profile.unlockedSkins, craft.defaultSkin],
    badges: profile.badges.includes(`arac-${craftId}`)
      ? profile.badges
      : [...profile.badges, `arac-${craftId}`],
  }
  saveProfile(next)
  return { ok: true, profile: next }
}

export function unlockSkin(
  profile: PlayerProfile,
  skinId: CraftSkinId,
  payWith: UnlockPayWith = 'credits',
): { ok: true; profile: PlayerProfile } | { ok: false; reason: string } {
  if (profile.unlockedSkins.includes(skinId)) {
    return { ok: false, reason: 'Zaten açık' }
  }
  const skin = SKINS[skinId]
  if (!skin) return { ok: false, reason: 'Bilinmeyen skin' }
  if (!profile.unlockedCrafts.includes(skin.craftId)) {
    return { ok: false, reason: 'Önce aracı aç' }
  }

  // Milestone path
  if (skin.requireBestX && profile.bestMultiplier >= skin.requireBestX) {
    const next = { ...profile, unlockedSkins: [...profile.unlockedSkins, skinId] }
    saveProfile(next)
    return { ok: true, profile: next }
  }
  if (skin.requireStreak && profile.streak >= skin.requireStreak) {
    const next = { ...profile, unlockedSkins: [...profile.unlockedSkins, skinId] }
    saveProfile(next)
    return { ok: true, profile: next }
  }

  if (skin.unlockCredits <= 0) {
    const next = { ...profile, unlockedSkins: [...profile.unlockedSkins, skinId] }
    saveProfile(next)
    return { ok: true, profile: next }
  }

  if (payWith === 'credits') {
    payWith = 'points'
  }

  const pts = scorePoints(profile.totalCashed)
  if (pts < skin.unlockCredits) {
    return { ok: false, reason: `En az ${skin.unlockCredits} puan gerekli` }
  }
  const next: PlayerProfile = {
    ...profile,
    totalCashed: Math.max(0, profile.totalCashed - skin.unlockCredits),
    unlockedSkins: [...profile.unlockedSkins, skinId],
  }
  saveProfile(next)
  return { ok: true, profile: next }
}

export function selectLoadout(
  profile: PlayerProfile,
  craftId: CraftId,
  skinId?: CraftSkinId,
): PlayerProfile {
  if (!profile.unlockedCrafts.includes(craftId)) return profile
  const skin =
    skinId &&
    profile.unlockedSkins.includes(skinId) &&
    SKINS[skinId].craftId === craftId
      ? skinId
      : profile.unlockedSkins.find((s) => SKINS[s].craftId === craftId) ??
        CRAFTS[craftId].defaultSkin

  const next: PlayerProfile = {
    ...profile,
    selectedCraft: craftId,
    selectedSkin: skin,
  }
  saveProfile(next)
  return next
}

export function buildLeaderboard(
  profile: PlayerProfile,
  friends: LeaderboardEntry[] = [],
): LeaderboardEntry[] {
  const bots: LeaderboardEntry[] = [
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
  ].map((name, i) => {
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

  // Friends also appear on global (deduped by id)
  const friendIds = new Set(friends.map((f) => f.id))
  const extra = friends.filter((f) => f.id !== 'you')
  const merged = [...bots.filter((b) => !friendIds.has(b.id)), ...extra, you]
  return merged.sort((a, b) => b.bestMultiplier - a.bestMultiplier)
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
  'roket-pilotu': 'Roket Pilotu',
  'nadir-filo': 'Nadir Filo',
  'arac-balloon': 'Balon Açıldı',
  'arac-plane': 'Uçak Açıldı',
  'arac-rocket': 'Roket Açıldı',
  'arac-kite': 'Uçurtma Açıldı',
  'arac-ufo': 'UFO Açıldı',
  'arac-paper': 'Kağıt Uçak Açıldı',
  'sinyal-bombasi': 'Sinyal Bombası',
  'gokyuzu-pilotu': 'Gökyüzü Pilotu',
  'kor-pilot': 'Kör Pilot',
  'ufo-kacis': 'Faz Kaçışı',
  'goz-kalkani': 'Göz Kalkanı',
  'gulumseme-inis': 'Gülümseme İniş',
  'selfie-pilot': 'Selfie Pilot',
  'telegram-pilot': 'Telegram Pilot',
  'filo-duello': 'Filo Düellosu',
  'chat-kor': 'Chat Kör Uçuş',
  'boost-masa': 'Boost Masa',
  'stars-pilot': 'Stars Pilot',
  'sezon-pilot': 'Sezon Pilot',
  'ruzgar-ustasi': 'Rüzgar Ustası',
  'lig-top10': 'Lig Top 10',
  'cuzdan-bagli': 'Cüzdan Bağlı',
  'cuzdan-acildi': 'Kripto Cüzdan',
  'checkin-pilot': 'Check-in Pilotu',
  'checkin-7': '7 Gün Seri',
  'davet-geldi': 'Davetle Geldi',
  'sosyal-pilot': 'Sosyal Pilot',
  'filo-davet': 'Davet Filosu',
  'onchain-yukle': 'On-chain Yükleme',
  'usdc-hosgeldin': 'USDC Hoşgeldin',
}
