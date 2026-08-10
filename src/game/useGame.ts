import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { fmtX, getLayerInfo, getLedLevel, rollCrash, todayKey } from './math'
import {
  createRng,
  loadDailyBest,
  updateDailyBestFromFlight,
  type DailyBest,
} from './challenge'
import {
  makeFlightSeed,
  replayCrashFlags,
  rngSeedFromString,
  sha256Hex,
  stakeAsUsdc,
} from './fairness'
import { toUsdcAmount } from './stableEconomy'
import {
  fetchDailyRemote,
  fetchFriendsRemote,
  fetchTopRemote,
  pushScore,
} from '../utils/syncApi'
import { requestTiltPermission } from '../utils/tilt'
import {
  WIND_MISS_RISK,
  applyWindBonus,
  sampleWind,
  windBonusFromCatches,
  windDirFromSeed,
  type WindDir,
} from './wind'
import {
  claimPassTier,
  daysLeftInWeek,
  grantSeasonXp,
  loadSeason,
  loadWeeklyBest,
  maybeWeeklyTopReward,
  seasonProgress,
  updateWeeklyFromFlight,
  weekKey,
  weeklySeed,
  xpForWeeklyFlight,
  type SeasonState,
} from './season'
import { fetchWeeklyRemote, pushWeeklyScore } from '../utils/leagueApi'

function pickBluffLed(
  craftId: CraftId,
  layer: number,
  real: LedLevel,
): LedLevel | null {
  if (craftId !== 'ufo' || layer < 3) return null
  // ~40% chance to lie about the LED
  if (Math.random() > 0.4) return null
  const options: LedLevel[] = ['safe', 'caution', 'critical'].filter(
    (l) => l !== real,
  ) as LedLevel[]
  return options[Math.floor(Math.random() * options.length)] ?? null
}
import {
  BOMB_POINT_COST,
  applyFlightResult,
  buildLeaderboard,
  buyBomb,
  loadProfile,
  saveProfile,
  selectLoadout,
  unlockCraft,
  unlockSkin,
  type UnlockPayWith,
} from './storage'
import type {
  CraftId,
  CraftSkinId,
  FlightPhase,
  FlightResult,
  LedLevel,
  PlayerProfile,
  Screen,
} from './types'
import { CRAFTS } from './vehicles'
import {
  ASSETS,
  isAssetId,
  normalizeBalances,
  roundAsset,
  type AssetId,
} from './assets'
import {
  canStakeCrypto,
  claimDemoPack,
  creditPayout,
  depositAsset,
  recordCrashStake,
  stakeForFlight,
} from './walletOps'
import {
  cancelWithdraw,
  creditOnChainDeposit,
  queueWithdraw,
} from './withdrawQueue'
import {
  AUTO_CASH_PRESETS,
  canCheckIn,
  claimCheckIn,
  claimFriendMilestones,
  claimReferralJoin,
  previewCheckIn,
} from './retention'
import { haptic } from '../utils/haptics'
import { sfx } from '../utils/audio'
import {
  applySkyBonus,
  formatSkyBonus,
  type SkySample,
} from '../utils/skyDetect'
import {
  consumeFriendFromUrl,
  friendInviteUrl,
  friendsToEntries,
  getOrCreatePilotId,
  loadFriends,
  profileToCard,
  removeFriend as removeFriendStorage,
  upsertFriend,
  type FriendCard,
} from './friends'
import {
  getStartParam,
  getTgUser,
  getWebApp,
  isTelegramMiniApp,
  telegramStartAppLink,
  tgDisplayName,
  tgShareUrl,
  tgSwitchInlineQuery,
} from '../telegram/webApp'
import {
  mergeCloudBlob,
  pullCloudProfile,
  pushCloudProfile,
} from '../telegram/cloudSync'
import { parseStartParam } from '../telegram/startParams'
import {
  duelInviteUrl,
  duelSeed,
  duelVerdict,
  fetchDuel,
  newDuelId,
  pushDuelScore,
  type DuelState,
} from '../telegram/duel'
import { BOOST_TABLE_USD, hasBoostAccess } from '../telegram/boost'
import {
  chatBlindInviteUrl,
  chatBlindSeed,
  chatBlindToken,
  isGroupChatOpen,
} from '../telegram/chatBlind'
import {
  STARS_FLIGHT_COST,
  STARS_WELCOME,
  buyStarsPack,
} from '../telegram/stars'
import { shareResultToStory } from '../telegram/story'
import {
  maybeStreakReminder,
  notifyMissionComplete,
  notifySafeLanding,
  requestNotifPermission,
  setNotifPref,
  getNotifPref,
  notifPermission,
} from '../utils/notifications'

interface GameState {
  screen: Screen
  profile: PlayerProfile
  phase: FlightPhase
  layer: number
  multiplier: number
  baseMultiplier: number
  led: LedLevel
  shaking: boolean
  windShake: boolean
  flash: boolean
  result: FlightResult | null
  consecutiveSafe: number
  tipVisible: boolean
  hangarMessage: string | null
  bombArmed: boolean
  bombUsedThisFlight: boolean
  shieldFlash: boolean
  skyScore: number
  skyBonus: number
  skyActive: boolean
  challengeMode: boolean
  blindMode: boolean
  weeklyMode: boolean
  /** UFO may show a lying LED */
  bluffLed: LedLevel | null
  ufoShieldReady: boolean
  /** Front-camera eye-contact shield ready */
  eyeShieldReady: boolean
  gazeActive: boolean
  smileActive: boolean
  facePresent: boolean
  windDir: WindDir | null
  windAlign: -1 | 0 | 1
  windBonus: number
  windCatches: number
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_PROFILE'; profile: PlayerProfile }
  | {
      type: 'START_FLIGHT'
      challenge: boolean
      blind: boolean
      weekly: boolean
      windDir: WindDir | null
    }
  | {
      type: 'CLIMB_SUCCESS'
      layer: number
      craftId: CraftId
      skyBonus: number
      windBonus: number
      bluffLed: LedLevel | null
    }
  | { type: 'SET_WIND_ALIGN'; align: -1 | 0 | 1 }
  | { type: 'WIND_CATCH'; catches: number; bonus: number }
  | { type: 'CRASH'; result: FlightResult }
  | { type: 'CASH_OUT'; result: FlightResult }
  | { type: 'PATCH_RESULT'; result: FlightResult }
  | { type: 'SET_PHASE'; phase: FlightPhase }
  | { type: 'SHAKE_OFF' }
  | { type: 'WIND_SHAKE_ON' }
  | { type: 'WIND_SHAKE_OFF' }
  | { type: 'FLASH_OFF' }
  | { type: 'HIDE_TIP' }
  | { type: 'RESET_TO_HOME' }
  | { type: 'RENAME'; name: string }
  | { type: 'HANGAR_MSG'; message: string | null }
  | { type: 'ARM_BOMB' }
  | { type: 'CONSUME_SHIELD' }
  | { type: 'CONSUME_UFO_SHIELD' }
  | { type: 'CONSUME_EYE_SHIELD' }
  | { type: 'SHIELD_FLASH_OFF' }
  | { type: 'SET_SKY'; sample: SkySample }
  | {
      type: 'SET_FACE'
      gaze: boolean
      smile: boolean
      face: boolean
    }

function initialState(): GameState {
  const profile = loadProfile()
  return {
    screen: 'home',
    profile,
    phase: 'idle',
    layer: 0,
    multiplier: 1,
    baseMultiplier: 1,
    led: 'safe',
    shaking: false,
    windShake: false,
    flash: false,
    result: null,
    consecutiveSafe: 0,
    tipVisible: true,
    hangarMessage: null,
    bombArmed: false,
    bombUsedThisFlight: false,
    shieldFlash: false,
    skyScore: 0,
    skyBonus: 0,
    skyActive: false,
    challengeMode: false,
    blindMode: false,
    weeklyMode: false,
    bluffLed: null,
    ufoShieldReady: false,
    eyeShieldReady: false,
    gazeActive: false,
    smileActive: false,
    facePresent: false,
    windDir: null,
    windAlign: 0,
    windBonus: 0,
    windCatches: 0,
  }
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen, hangarMessage: null }
    case 'SET_PROFILE':
      return { ...state, profile: action.profile }
    case 'SET_SKY': {
      const fairLock =
        state.challengeMode || state.blindMode || state.weeklyMode
      const next = {
        ...state,
        skyScore: action.sample.score,
        skyBonus: fairLock ? 0 : action.sample.bonus,
        skyActive: fairLock ? false : action.sample.active,
      }
      if (!fairLock && state.phase === 'climbing' && state.layer >= 1) {
        next.multiplier = applyWindBonus(
          applySkyBonus(state.baseMultiplier, action.sample.bonus),
          state.windBonus,
        )
      }
      return next
    }
    case 'START_FLIGHT': {
      const fair =
        action.challenge || action.blind || action.weekly
      return {
        ...state,
        screen: 'flight',
        phase: 'climbing',
        layer: 0,
        multiplier: 1,
        baseMultiplier: 1,
        led: 'safe',
        shaking: false,
        windShake: false,
        flash: false,
        result: null,
        bombArmed: false,
        bombUsedThisFlight: false,
        shieldFlash: false,
        challengeMode: action.challenge,
        blindMode: action.blind,
        weeklyMode: action.weekly,
        bluffLed: null,
        ufoShieldReady: state.profile.selectedCraft === 'ufo',
        eyeShieldReady: !fair,
        gazeActive: false,
        smileActive: false,
        facePresent: false,
        skyBonus: fair ? 0 : state.skyBonus,
        skyActive: fair ? false : state.skyActive,
        windDir: fair ? null : action.windDir,
        windAlign: 0,
        windBonus: 0,
        windCatches: 0,
      }
    }
    case 'CLIMB_SUCCESS': {
      const info = getLayerInfo(action.layer, action.craftId)
      const fair =
        state.challengeMode || state.blindMode || state.weeklyMode
      const sky = fair ? 0 : action.skyBonus
      const wind = fair ? 0 : action.windBonus
      const boosted = applyWindBonus(applySkyBonus(info.multiplier, sky), wind)
      return {
        ...state,
        phase: 'climbing',
        layer: action.layer,
        baseMultiplier: info.multiplier,
        multiplier: boosted,
        led: getLedLevel(action.layer, action.craftId),
        bluffLed: action.bluffLed,
        windBonus: wind,
      }
    }
    case 'SET_WIND_ALIGN':
      return { ...state, windAlign: action.align }
    case 'WIND_CATCH':
      return {
        ...state,
        windCatches: action.catches,
        windBonus: action.bonus,
      }
    case 'CRASH':
      return {
        ...state,
        phase: 'crashing',
        shaking: true,
        windShake: false,
        flash: true,
        result: action.result,
        led: 'critical',
        bombArmed: false,
      }
    case 'CASH_OUT':
      return {
        ...state,
        phase: 'landing',
        windShake: false,
        result: action.result,
        bombArmed: false,
      }
    case 'PATCH_RESULT':
      return { ...state, result: action.result }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SHAKE_OFF':
      return { ...state, shaking: false }
    case 'WIND_SHAKE_ON':
      return { ...state, windShake: true }
    case 'WIND_SHAKE_OFF':
      return { ...state, windShake: false }
    case 'FLASH_OFF':
      return { ...state, flash: false }
    case 'HIDE_TIP':
      return { ...state, tipVisible: false }
    case 'RESET_TO_HOME':
      return {
        ...state,
        screen: 'home',
        phase: 'idle',
        layer: 0,
        multiplier: 1,
        baseMultiplier: 1,
        led: 'safe',
        shaking: false,
        windShake: false,
        flash: false,
        result: null,
        bombArmed: false,
        bombUsedThisFlight: false,
        shieldFlash: false,
        challengeMode: false,
        blindMode: false,
        weeklyMode: false,
        bluffLed: null,
        ufoShieldReady: false,
        eyeShieldReady: false,
        gazeActive: false,
        smileActive: false,
        facePresent: false,
        windDir: null,
        windAlign: 0,
        windBonus: 0,
        windCatches: 0,
      }
    case 'RENAME': {
      const profile = { ...state.profile, displayName: action.name }
      saveProfile(profile)
      return { ...state, profile }
    }
    case 'HANGAR_MSG':
      return { ...state, hangarMessage: action.message }
    case 'ARM_BOMB':
      return {
        ...state,
        bombArmed: true,
        bombUsedThisFlight: true,
        shieldFlash: true,
        led: 'safe',
      }
    case 'CONSUME_SHIELD':
      return { ...state, bombArmed: false }
    case 'CONSUME_UFO_SHIELD':
      return {
        ...state,
        ufoShieldReady: false,
        shieldFlash: true,
        bluffLed: null,
        led: 'safe',
      }
    case 'CONSUME_EYE_SHIELD':
      return {
        ...state,
        eyeShieldReady: false,
        shieldFlash: true,
        led: 'safe',
      }
    case 'SET_FACE':
      return {
        ...state,
        gazeActive: action.gaze,
        smileActive: action.smile,
        facePresent: action.face,
      }
    case 'SHIELD_FLASH_OFF':
      return { ...state, shieldFlash: false }
    default:
      return state
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [friends, setFriends] = useState<FriendCard[]>(() => loadFriends())
  const [notifOn, setNotifOn] = useState(() => getNotifPref())
  const [dailyBest, setDailyBest] = useState<DailyBest | null>(() => loadDailyBest())
  const [dailyBoard, setDailyBoard] = useState<FriendCard[]>([])
  const [remoteTop, setRemoteTop] = useState<FriendCard[]>([])
  const [syncHint, setSyncHint] = useState<string | null>(null)
  const [retentionHint, setRetentionHint] = useState<string | null>(null)
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null)
  const [duelBoard, setDuelBoard] = useState<DuelState | null>(null)
  const [pendingChatBlind, setPendingChatBlind] = useState<string | null>(null)
  const [boostUnlocked, setBoostUnlocked] = useState(() => hasBoostAccess())
  const [weeklyBoard, setWeeklyBoard] = useState<
    Awaited<ReturnType<typeof fetchWeeklyRemote>>
  >([])
  const [season, setSeason] = useState<SeasonState>(() => loadSeason())
  const [weeklyBest, setWeeklyBest] = useState(() => loadWeeklyBest())
  const duelIdRef = useRef<string | null>(null)
  const chatBlindRef = useRef<string | null>(null)
  const boostTableRef = useRef(false)
  const starsStakeRef = useRef(0)
  const weeklyRef = useRef(false)
  const windDirRef = useRef<WindDir | null>(null)
  const windCatchesRef = useRef(0)
  const windAlignRef = useRef<-1 | 0 | 1>(0)
  const tiltXRef = useRef(0)
  const tiltYRef = useRef(0)
  const consecutiveRef = useRef(state.consecutiveSafe)
  const animatingRef = useRef(false)
  const craftRef = useRef(state.profile.selectedCraft)
  const skinRef = useRef(state.profile.selectedSkin)
  const bombArmedRef = useRef(false)
  const bombUsedRef = useRef(false)
  const skyBonusRef = useRef(0)
  const skyActiveRef = useRef(false)
  const challengeRef = useRef(false)
  const blindRef = useRef(false)
  const ufoShieldRef = useRef(false)
  const eyeShieldRef = useRef(false)
  const eyeShieldUsedRef = useRef(false)
  const gazeRef = useRef(false)
  const smileCashOutRef = useRef(false)
  const rngRef = useRef<() => number>(Math.random)
  const stakeAssetRef = useRef<AssetId | null>(null)
  const stakeAmountRef = useRef(0)
  const cashOutRef = useRef<() => void>(() => {})
  const fairSeedRef = useRef('')
  const fairCommitRef = useRef('')
  const fairRollsRef = useRef(0)
  const [fairCommit, setFairCommit] = useState('')

  const refreshSync = useCallback(async () => {
    const local = loadFriends()
    const ids = local.map((f) => f.id)
    const [remoteFriends, daily, top, weekly] = await Promise.all([
      fetchFriendsRemote(ids),
      fetchDailyRemote(),
      fetchTopRemote(),
      fetchWeeklyRemote(weekKey()),
    ])
    if (remoteFriends.length) {
      for (const card of remoteFriends) upsertFriend(card)
      setFriends(loadFriends())
    }
    setDailyBoard(daily)
    setRemoteTop(top)
    setWeeklyBoard(weekly)
  }, [])

  useEffect(() => {
    getOrCreatePilotId()

    // Telegram Mini App: identity + startapp invite + CloudStorage
    if (isTelegramMiniApp()) {
      const tgUser = getTgUser()
      if (tgUser) {
        let profile = loadProfile()
        let touched = false
        if (profile.displayName === 'Pilot') {
          profile = { ...profile, displayName: tgDisplayName(tgUser) }
          touched = true
        }
        if (!profile.badges.includes('telegram-pilot')) {
          profile = {
            ...profile,
            badges: [...profile.badges, 'telegram-pilot'],
          }
          touched = true
        }
        if (touched) {
          saveProfile(profile)
          dispatch({ type: 'SET_PROFILE', profile })
        }
      }
      const start = parseStartParam(getStartParam())
      if (start?.kind === 'ref' && start.pilotId !== getOrCreatePilotId()) {
        upsertFriend({
          id: start.pilotId,
          name: 'TG Davet',
          bestMultiplier: 0,
          bestLayer: 0,
          streak: 0,
          updatedAt: Date.now(),
        })
        setFriends(loadFriends())
        const joined = claimReferralJoin(loadProfile(), start.pilotId)
        if (joined.ok) {
          saveProfile(joined.profile)
          dispatch({ type: 'SET_PROFILE', profile: joined.profile })
          setRetentionHint(joined.message)
          window.setTimeout(() => setRetentionHint(null), 4000)
        }
      }
      if (start?.kind === 'duel') {
        setActiveDuelId(start.duelId)
        duelIdRef.current = start.duelId
        void fetchDuel(start.duelId).then((d) => {
          if (d) setDuelBoard(d)
        })
        setRetentionHint('Filo düellosu · aynı seed')
        window.setTimeout(() => setRetentionHint(null), 3500)
      }
      if (start?.kind === 'chatBlind') {
        setPendingChatBlind(start.token)
        chatBlindRef.current = start.token
        setRetentionHint('Chat kör uçuş hazır')
        window.setTimeout(() => setRetentionHint(null), 3500)
      }
      if (start?.kind === 'boost') {
        setBoostUnlocked(true)
      }
      if (isGroupChatOpen() && !start) {
        const tok = chatBlindToken()
        setPendingChatBlind(tok)
        chatBlindRef.current = tok
      }
      // Welcome Stars
      {
        const p = loadProfile()
        if (!p.starsWelcomeClaimed) {
          const gifted: PlayerProfile = {
            ...p,
            starsBalance: p.starsBalance + STARS_WELCOME,
            starsWelcomeClaimed: true,
            badges: p.badges.includes('stars-pilot')
              ? p.badges
              : [...p.badges, 'stars-pilot'],
          }
          saveProfile(gifted)
          dispatch({ type: 'SET_PROFILE', profile: gifted })
          setRetentionHint(`+${STARS_WELCOME} Stars hoşgeldin`)
          window.setTimeout(() => setRetentionHint(null), 3500)
        }
      }
      setBoostUnlocked(hasBoostAccess(start?.kind === 'boost'))
      void pullCloudProfile().then((blob) => {
        if (!blob) return
        const merged = mergeCloudBlob(loadProfile(), blob)
        saveProfile(merged)
        dispatch({ type: 'SET_PROFILE', profile: merged })
        void pushCloudProfile(merged)
      })
    }

    // Web query fallbacks (?duel= ?cb= ?boost=1)
    try {
      const q = new URL(location.href)
      const duelQ = q.searchParams.get('duel')
      const cbQ = q.searchParams.get('cb')
      if (duelQ) {
        setActiveDuelId(duelQ)
        duelIdRef.current = duelQ
      }
      if (cbQ) {
        setPendingChatBlind(cbQ)
        chatBlindRef.current = cbQ
      }
      if (q.searchParams.get('boost') === '1') setBoostUnlocked(true)
    } catch {
      // ignore
    }

    const imported = consumeFriendFromUrl()
    if (imported) {
      setFriends(loadFriends())
      const profile = loadProfile()
      const joined = claimReferralJoin(profile, imported.id)
      if (joined.ok) {
        saveProfile(joined.profile)
        dispatch({ type: 'SET_PROFILE', profile: joined.profile })
        setRetentionHint(joined.message)
        window.setTimeout(() => setRetentionHint(null), 4000)
      }
      const milestone = claimFriendMilestones(
        loadProfile(),
        loadFriends().length,
      )
      if (milestone?.ok) {
        saveProfile(milestone.profile)
        dispatch({ type: 'SET_PROFILE', profile: milestone.profile })
      }
    }
    void maybeStreakReminder({
      streak: state.profile.streak,
      lastFlightDate: state.profile.lastFlightDate,
      today: todayKey(),
    })
    void pushScore(loadProfile()).then((ok) => {
      if (ok) void refreshSync()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  useEffect(() => {
    consecutiveRef.current = state.consecutiveSafe
  }, [state.consecutiveSafe])

  useEffect(() => {
    craftRef.current = state.profile.selectedCraft
    skinRef.current = state.profile.selectedSkin
  }, [state.profile.selectedCraft, state.profile.selectedSkin])

  useEffect(() => {
    bombArmedRef.current = state.bombArmed
  }, [state.bombArmed])

  useEffect(() => {
    bombUsedRef.current = state.bombUsedThisFlight
  }, [state.bombUsedThisFlight])

  useEffect(() => {
    skyBonusRef.current = state.skyBonus
    skyActiveRef.current = state.skyActive
  }, [state.skyBonus, state.skyActive])

  // Auto cash-out when multiplier hits target
  useEffect(() => {
    if (state.phase !== 'climbing' || state.layer < 1) return
    const target = state.profile.autoCashOut
    if (!target || target <= 0) return
    if (state.multiplier + 1e-9 < target) return
    const t = window.setTimeout(() => cashOutRef.current(), 320)
    return () => window.clearTimeout(t)
  }, [state.phase, state.layer, state.multiplier, state.profile.autoCashOut])

  // Smile cash-out near auto target (or default 2x)
  useEffect(() => {
    if (state.phase !== 'climbing' || state.layer < 1) return
    if (state.challengeMode || state.blindMode) return
    if (!state.smileActive) return
    const target =
      state.profile.autoCashOut > 0 ? state.profile.autoCashOut : 2
    if (state.multiplier + 1e-9 < target * 0.92) return
    const t = window.setTimeout(() => {
      smileCashOutRef.current = true
      cashOutRef.current()
    }, 380)
    return () => window.clearTimeout(t)
  }, [
    state.phase,
    state.layer,
    state.multiplier,
    state.smileActive,
    state.profile.autoCashOut,
    state.challengeMode,
    state.blindMode,
  ])

  const setSkySample = useCallback((sample: SkySample) => {
    const wasActive = skyActiveRef.current
    dispatch({ type: 'SET_SKY', sample })
    if (!wasActive && sample.active) {
      haptic.warn()
      sfx.warn()
    }
  }, [])

  const setFaceSample = useCallback(
    (sample: { face: boolean; gaze: boolean; smile: boolean }) => {
      if (state.challengeMode || state.blindMode || state.weeklyMode) {
        gazeRef.current = false
        dispatch({
          type: 'SET_FACE',
          face: false,
          gaze: false,
          smile: false,
        })
        return
      }
      gazeRef.current = sample.gaze
      dispatch({
        type: 'SET_FACE',
        face: sample.face,
        gaze: sample.gaze && eyeShieldRef.current,
        smile: sample.smile,
      })
    },
    [state.challengeMode, state.blindMode, state.weeklyMode],
  )

  const setTiltSample = useCallback(
    (x: number, y: number) => {
      tiltXRef.current = x
      tiltYRef.current = y
      const dir = windDirRef.current
      if (!dir || weeklyRef.current || challengeRef.current || blindRef.current) {
        windAlignRef.current = 0
        return
      }
      const sample = sampleWind(dir, x, y)
      windAlignRef.current = sample.align
      dispatch({ type: 'SET_WIND_ALIGN', align: sample.align })
    },
    [],
  )

  const windRisk = useCallback(() => {
    if (challengeRef.current || blindRef.current || weeklyRef.current) return 0
    return windAlignRef.current === -1 ? WIND_MISS_RISK : 0
  }, [])

  const noteWindCatch = useCallback(() => {
    if (challengeRef.current || blindRef.current || weeklyRef.current) return 0
    if (windAlignRef.current !== 1) return 0
    windCatchesRef.current += 1
    const bonus = windBonusFromCatches(windCatchesRef.current)
    dispatch({
      type: 'WIND_CATCH',
      catches: windCatchesRef.current,
      bonus,
    })
    haptic.warn()
    return bonus
  }, [])

  const persistResult = useCallback((result: FlightResult) => {
    let before = loadProfile()
    let settled = result

    // Crypto payout on safe landing (stake already deducted at takeoff)
    if (
      settled.outcome === 'cashed' &&
      settled.stakeAsset &&
      settled.stakeAmount &&
      settled.stakeAmount > 0
    ) {
      const payout = roundAsset(
        settled.stakeAmount * settled.multiplier,
        settled.stakeAsset,
      )
      const paid = creditPayout(
        before,
        settled.stakeAsset,
        payout,
        settled.multiplier,
      )
      if (paid.ok) {
        before = { ...before, ...paid.profilePatch, balances: paid.balances }
        saveProfile(before)
        settled = {
          ...settled,
          payoutAmount: payout,
          ledgerId: paid.entry.id,
          usdcPayout: toUsdcAmount(payout, settled.stakeAsset),
        }
      }
    } else if (
      settled.outcome === 'crashed' &&
      settled.stakeAsset &&
      settled.stakeAmount &&
      settled.stakeAmount > 0
    ) {
      recordCrashStake(settled.stakeAsset, settled.stakeAmount)
      settled = {
        ...settled,
        usdcPayout: -stakeAsUsdc(settled.stakeAmount, settled.stakeAsset),
      }
    }

    const { profile, consecutiveSafe } = applyFlightResult(
      before,
      settled,
      consecutiveRef.current,
    )
    consecutiveRef.current = consecutiveSafe
    dispatch({ type: 'PATCH_RESULT', result: settled })
    dispatch({ type: 'SET_PROFILE', profile })

    if (settled.challenge) {
      const best = updateDailyBestFromFlight(
        settled.multiplier,
        settled.layer,
        settled.craftId,
        settled.outcome,
      )
      if (best) setDailyBest(best)
    }

    if (settled.weekly) {
      const w = updateWeeklyFromFlight(
        settled.multiplier,
        settled.layer,
        settled.craftId,
        settled.outcome,
      )
      setWeeklyBest(w)
      const xp = xpForWeeklyFlight(
        settled.outcome,
        settled.multiplier,
        settled.layer,
      )
      setSeason(grantSeasonXp(xp))
      void pushWeeklyScore(profile, w).then(async () => {
        const board = await fetchWeeklyRemote(weekKey())
        setWeeklyBoard(board)
        const me = getOrCreatePilotId()
        const rank = board.findIndex((p) => p.id === me) + 1
        const rewarded = maybeWeeklyTopReward(w, rank > 0 ? rank : null)
        setSeason(rewarded)
        if (rank > 0 && rank <= 10) {
          const p = loadProfile()
          if (!p.badges.includes('lig-top10')) {
            const next = { ...p, badges: [...p.badges, 'lig-top10'] }
            saveProfile(next)
            dispatch({ type: 'SET_PROFILE', profile: next })
          }
        }
      })
    }

    for (let i = 0; i < profile.missions.length; i++) {
      const after = profile.missions[i]
      const prev = before.missions[i]
      if (after?.completed && prev && !prev.completed) {
        void notifyMissionComplete(after.label)
      }
    }
    if (settled.outcome === 'cashed') {
      void notifySafeLanding(fmtX(settled.multiplier))
    }

    void pushScore(profile).then((ok) => {
      if (ok) void refreshSync()
    })
    void pushCloudProfile(profile)

    if (settled.duelId) {
      const me = getOrCreatePilotId()
      void pushDuelScore(settled.duelId, {
        pilotId: me,
        name: profile.displayName,
        multiplier: settled.outcome === 'cashed' ? settled.multiplier : 0,
        layer: settled.layer,
        outcome: settled.outcome,
        at: settled.timestamp,
      }).then((board) => {
        if (board) setDuelBoard(board)
      })
    }
    return consecutiveSafe
  }, [refreshSync])

  const enrichResult = useCallback((result: FlightResult): FlightResult => {
    const seed = fairSeedRef.current
    const commit = fairCommitRef.current
    const rolls = fairRollsRef.current
    const flags = seed ? replayCrashFlags(seed, result.craftId, rolls) : []
    const usdcStake =
      result.stakeAsset && result.stakeAmount != null
        ? stakeAsUsdc(result.stakeAmount, result.stakeAsset)
        : undefined
    const usdcPayout =
      result.stakeAsset && result.stakeAmount != null
        ? result.outcome === 'cashed'
          ? toUsdcAmount(
              result.payoutAmount ?? result.stakeAmount * result.multiplier,
              result.stakeAsset,
            )
          : -usdcStake!
        : undefined
    return {
      ...result,
      fairSeed: seed || undefined,
      fairCommit: commit || undefined,
      fairRolls: rolls || undefined,
      fairCrashFlags: flags.length ? flags : undefined,
      usdcStake,
      usdcPayout,
    }
  }, [])

  const addFriend = useCallback((card: FriendCard) => {
    const me = getOrCreatePilotId()
    if (card.id === me) return false
    const list = upsertFriend(card, me)
    setFriends(list)
    const milestone = claimFriendMilestones(loadProfile(), list.length)
    if (milestone?.ok) {
      saveProfile(milestone.profile)
      dispatch({ type: 'SET_PROFILE', profile: milestone.profile })
      setRetentionHint(milestone.message)
      window.setTimeout(() => setRetentionHint(null), 3500)
    }
    return true
  }, [])

  const removeFriend = useCallback((id: string) => {
    setFriends(removeFriendStorage(id))
  }, [])

  const enableNotifications = useCallback(async () => {
    const perm = await requestNotifPermission()
    const on = perm === 'granted'
    setNotifPref(on)
    setNotifOn(on)
    return on
  }, [])

  const disableNotifications = useCallback(() => {
    setNotifPref(false)
    setNotifOn(false)
  }, [])

  const startFlight = useCallback(async (opts?: {
    challenge?: boolean
    blind?: boolean
    weekly?: boolean
    duelId?: string
    chatBlind?: boolean
    boostTable?: boolean
    payWithStars?: boolean
  }) => {
    const profile = loadProfile()
    let payAsset = isAssetId(profile.payAsset) ? profile.payAsset : 'usdc'
    if (!profile.highRoller && payAsset !== 'usdt' && payAsset !== 'usdc') {
      payAsset = 'usdc'
    }
    const boostTable =
      Boolean(opts?.boostTable) && hasBoostAccess(boostUnlocked)
    let stakeAmt =
      Number.isFinite(profile.stakeAmount) && profile.stakeAmount > 0
        ? roundAsset(profile.stakeAmount, payAsset)
        : profile.highRoller
          ? ASSETS[payAsset].flightStake
          : 1
    if (boostTable) {
      payAsset = 'usdc'
      stakeAmt = BOOST_TABLE_USD
    }
    const useStars =
      Boolean(opts?.payWithStars || profile.payWithStars) &&
      profile.starsBalance >= STARS_FLIGHT_COST
    const useCrypto = !useStars && canStakeCrypto(profile, payAsset, stakeAmt)

    const craftId = profile.selectedCraft
    const skinId = profile.selectedSkin
    // Only attach duel/chat modes when explicitly requested
    const duelId = opts?.duelId || null
    const chatTok = opts?.chatBlind
      ? pendingChatBlind || chatBlindToken()
      : null
    const weekly = Boolean(opts?.weekly) && !duelId && !chatTok
    const challenge =
      Boolean(opts?.challenge) && !duelId && !chatTok && !weekly
    const blind =
      (Boolean(opts?.blind) || Boolean(chatTok)) &&
      !challenge &&
      !duelId &&
      !weekly
    challengeRef.current = challenge
    blindRef.current = blind
    weeklyRef.current = weekly
    ufoShieldRef.current = craftId === 'ufo'
    eyeShieldRef.current = !challenge && !blind && !duelId && !weekly
    eyeShieldUsedRef.current = false
    smileCashOutRef.current = false
    gazeRef.current = false
    duelIdRef.current = duelId
    chatBlindRef.current = chatTok
    boostTableRef.current = boostTable
    starsStakeRef.current = useStars ? STARS_FLIGHT_COST : 0
    windCatchesRef.current = 0
    windAlignRef.current = 0

    const fairSeed = duelId
      ? duelSeed(duelId, craftId)
      : chatTok
        ? chatBlindSeed(chatTok, craftId)
        : weekly
          ? weeklySeed(craftId)
          : challenge
            ? `zincir-challenge-${todayKey()}-${craftId}`
            : makeFlightSeed(blind ? 'blind' : 'normal')
    fairSeedRef.current = fairSeed
    fairCommitRef.current = ''
    fairRollsRef.current = 0
    setFairCommit('')
    rngRef.current = createRng(rngSeedFromString(fairSeed))
    const commit = await sha256Hex(fairSeed)
    fairCommitRef.current = commit
    setFairCommit(commit)
    const windDir =
      challenge || blind || weekly || duelId ? null : windDirFromSeed(fairSeed)
    windDirRef.current = windDir

    let spent: PlayerProfile = { ...profile }
    if (useStars) {
      spent = {
        ...spent,
        starsBalance: spent.starsBalance - STARS_FLIGHT_COST,
      }
      stakeAssetRef.current = null
      stakeAmountRef.current = 0
    } else if (useCrypto) {
      const staked = stakeForFlight(spent, payAsset, stakeAmt)
      if (!staked.ok) return false
      spent = {
        ...spent,
        ...staked.profilePatch,
        balances: staked.balances,
      }
      stakeAssetRef.current = payAsset
      stakeAmountRef.current = stakeAmt
    } else {
      // Free flight — pil removed
      stakeAssetRef.current = null
      stakeAmountRef.current = 0
    }
    saveProfile(spent)
    dispatch({ type: 'SET_PROFILE', profile: spent })

    void sfx.unlock()
    void requestTiltPermission()
    haptic.tap(craftId)
    sfx.climb(craftId)
    dispatch({ type: 'START_FLIGHT', challenge, blind, weekly, windDir })
    bombArmedRef.current = false
    bombUsedRef.current = false
    sfx.startProp(craftId)

    const takeoffMs = Math.round(700 / CRAFTS[craftId].climbVisual)
    const fairLock = () =>
      challengeRef.current || blindRef.current || weeklyRef.current
    const stakeMeta = () => ({
      ...(stakeAssetRef.current && stakeAmountRef.current > 0
        ? {
            stakeAsset: stakeAssetRef.current,
            stakeAmount: stakeAmountRef.current,
          }
        : {}),
      ...(duelIdRef.current ? { duelId: duelIdRef.current } : {}),
      ...(chatBlindRef.current ? { chatBlind: true } : {}),
      ...(boostTableRef.current ? { boostTable: true } : {}),
      ...(starsStakeRef.current > 0 ? { starsStake: starsStakeRef.current } : {}),
      ...(weeklyRef.current ? { weekly: true } : {}),
      ...(windCatchesRef.current > 0
        ? { windCatches: windCatchesRef.current }
        : {}),
    })
    window.setTimeout(() => {
      const rng = rngRef.current
      fairRollsRef.current += 1
      if (rollCrash(1, craftId, false, rng, windRisk())) {
        // Eye-contact shield (front camera) then UFO phase shield
        if (eyeShieldRef.current && gazeRef.current) {
          eyeShieldRef.current = false
          eyeShieldUsedRef.current = true
          dispatch({ type: 'CONSUME_EYE_SHIELD' })
          window.setTimeout(() => dispatch({ type: 'SHIELD_FLASH_OFF' }), 600)
          haptic.bomb()
          sfx.bomb()
          haptic.climb(craftId)
          sfx.setPropLayer(1, craftId)
          const real = getLedLevel(1, craftId)
          dispatch({
            type: 'CLIMB_SUCCESS',
            layer: 1,
            craftId,
            skyBonus: fairLock() ? 0 : skyBonusRef.current,
            windBonus: fairLock()
              ? 0
              : windBonusFromCatches(windCatchesRef.current),
            bluffLed: pickBluffLed(craftId, 1, real),
          })
          return
        }
        if (ufoShieldRef.current) {
          ufoShieldRef.current = false
          dispatch({ type: 'CONSUME_UFO_SHIELD' })
          window.setTimeout(() => dispatch({ type: 'SHIELD_FLASH_OFF' }), 600)
          haptic.bomb()
          sfx.bomb()
          haptic.climb(craftId)
          sfx.setPropLayer(1, craftId)
          const real = getLedLevel(1, craftId)
          dispatch({
            type: 'CLIMB_SUCCESS',
            layer: 1,
            craftId,
            skyBonus: fairLock() ? 0 : skyBonusRef.current,
            windBonus: fairLock()
              ? 0
              : windBonusFromCatches(windCatchesRef.current),
            bluffLed: pickBluffLed(craftId, 1, real),
          })
          return
        }
        const near = getLayerInfo(1, craftId)
        const skyB = fairLock() ? 0 : skyBonusRef.current
        const result = enrichResult({
          outcome: 'crashed',
          layer: 0,
          multiplier: 1,
          nearMissMultiplier: applySkyBonus(near.multiplier, skyB),
          timestamp: Date.now(),
          craftId,
          skinId,
          bombUsed: false,
          skyBonus: skyB,
          challenge: challengeRef.current,
          blind: blindRef.current,
          eyeShieldUsed: eyeShieldUsedRef.current,
          ...stakeMeta(),
        })
        haptic.crash(craftId)
        sfx.crash(craftId)
        dispatch({ type: 'CRASH', result })
        persistResult(result)
        window.setTimeout(() => {
          dispatch({ type: 'SET_PHASE', phase: 'done' })
          dispatch({ type: 'SET_SCREEN', screen: 'result' })
          dispatch({ type: 'SHAKE_OFF' })
          dispatch({ type: 'FLASH_OFF' })
        }, 900)
      } else {
        noteWindCatch()
        haptic.climb(craftId)
        sfx.setPropLayer(1, craftId)
        const real = getLedLevel(1, craftId)
        dispatch({
          type: 'CLIMB_SUCCESS',
          layer: 1,
          craftId,
          skyBonus: fairLock() ? 0 : skyBonusRef.current,
          windBonus: fairLock()
            ? 0
            : windBonusFromCatches(windCatchesRef.current),
          bluffLed: pickBluffLed(craftId, 1, real),
        })
      }
    }, takeoffMs)
    return true
  }, [
    persistResult,
    enrichResult,
    pendingChatBlind,
    boostUnlocked,
    noteWindCatch,
    windRisk,
  ])

  const armBomb = useCallback(() => {
    if (state.challengeMode || state.blindMode || challengeRef.current || blindRef.current)
      return false
    if (state.phase !== 'climbing' || state.layer < 1) return false
    if (state.bombArmed) return false
    if (animatingRef.current) return false

    const profile = loadProfile()
    if ((profile.bombs ?? 0) <= 0) return false

    const spent: PlayerProfile = {
      ...profile,
      bombs: profile.bombs - 1,
    }
    saveProfile(spent)
    dispatch({ type: 'SET_PROFILE', profile: spent })
    dispatch({ type: 'ARM_BOMB' })
    bombArmedRef.current = true
    bombUsedRef.current = true
    haptic.bomb()
    sfx.bomb()
    window.setTimeout(() => dispatch({ type: 'SHIELD_FLASH_OFF' }), 600)
    return true
  }, [
    state.phase,
    state.layer,
    state.bombArmed,
    state.challengeMode,
    state.blindMode,
  ])

  const climb = useCallback(() => {
    if (animatingRef.current) return
    if (state.phase !== 'climbing' || state.layer < 1) return
    animatingRef.current = true
    const craftId = craftRef.current
    const skinId = skinRef.current
    const challenge = challengeRef.current
    const blind = blindRef.current
    const weekly = weeklyRef.current
    const fairLock = challenge || blind || weekly
    const shielded = fairLock ? false : bombArmedRef.current
    const skyB = fairLock ? 0 : skyBonusRef.current
    void sfx.unlock()
    haptic.climb(craftId)
    sfx.climb(craftId)

    const nextLayer = state.layer + 1
    const delay = Math.round(350 / CRAFTS[craftId].climbVisual)

    if (shielded) {
      dispatch({ type: 'CONSUME_SHIELD' })
      bombArmedRef.current = false
    }

    // Brief climb gust on screen
    if (nextLayer >= 2) {
      dispatch({ type: 'WIND_SHAKE_ON' })
      window.setTimeout(() => dispatch({ type: 'WIND_SHAKE_OFF' }), 280)
    }

    window.setTimeout(() => {
      fairRollsRef.current += 1
      if (rollCrash(nextLayer, craftId, shielded, rngRef.current, windRisk())) {
        if (eyeShieldRef.current && gazeRef.current) {
          eyeShieldRef.current = false
          eyeShieldUsedRef.current = true
          dispatch({ type: 'CONSUME_EYE_SHIELD' })
          window.setTimeout(() => dispatch({ type: 'SHIELD_FLASH_OFF' }), 600)
          haptic.bomb()
          sfx.bomb()
          sfx.setPropLayer(nextLayer, craftId)
          const real = getLedLevel(nextLayer, craftId)
          dispatch({
            type: 'CLIMB_SUCCESS',
            layer: nextLayer,
            craftId,
            skyBonus: skyB,
            windBonus: fairLock
              ? 0
              : windBonusFromCatches(windCatchesRef.current),
            bluffLed: pickBluffLed(craftId, nextLayer, real),
          })
          animatingRef.current = false
          return
        }
        if (ufoShieldRef.current) {
          ufoShieldRef.current = false
          dispatch({ type: 'CONSUME_UFO_SHIELD' })
          window.setTimeout(() => dispatch({ type: 'SHIELD_FLASH_OFF' }), 600)
          haptic.bomb()
          sfx.bomb()
          sfx.setPropLayer(nextLayer, craftId)
          const real = getLedLevel(nextLayer, craftId)
          dispatch({
            type: 'CLIMB_SUCCESS',
            layer: nextLayer,
            craftId,
            skyBonus: skyB,
            windBonus: fairLock
              ? 0
              : windBonusFromCatches(windCatchesRef.current),
            bluffLed: pickBluffLed(craftId, nextLayer, real),
          })
          animatingRef.current = false
          return
        }
        const near = getLayerInfo(nextLayer, craftId)
        const result = enrichResult({
          outcome: 'crashed',
          layer: state.layer,
          multiplier: state.multiplier,
          nearMissMultiplier: applySkyBonus(near.multiplier, skyB),
          timestamp: Date.now(),
          craftId,
          skinId,
          bombUsed: bombUsedRef.current,
          skyBonus: skyB,
          challenge,
          blind,
          weekly,
          eyeShieldUsed: eyeShieldUsedRef.current,
          windCatches: windCatchesRef.current || undefined,
          ...(stakeAssetRef.current && stakeAmountRef.current > 0
            ? {
                stakeAsset: stakeAssetRef.current,
                stakeAmount: stakeAmountRef.current,
              }
            : {}),
          ...(duelIdRef.current ? { duelId: duelIdRef.current } : {}),
          ...(chatBlindRef.current ? { chatBlind: true } : {}),
          ...(boostTableRef.current ? { boostTable: true } : {}),
          ...(starsStakeRef.current > 0
            ? { starsStake: starsStakeRef.current }
            : {}),
        })
        haptic.crash(craftId)
        sfx.crash(craftId)
        dispatch({ type: 'CRASH', result })
        persistResult(result)
        window.setTimeout(() => {
          dispatch({ type: 'SET_PHASE', phase: 'done' })
          dispatch({ type: 'SET_SCREEN', screen: 'result' })
          dispatch({ type: 'SHAKE_OFF' })
          dispatch({ type: 'FLASH_OFF' })
          animatingRef.current = false
        }, 1000)
      } else {
        noteWindCatch()
        sfx.setPropLayer(nextLayer, craftId)
        const led = getLedLevel(nextLayer, craftId)
        sfx.setStatic(led === 'critical' ? 0.85 : led === 'caution' ? 0.4 : 0.1)
        dispatch({
          type: 'CLIMB_SUCCESS',
          layer: nextLayer,
          craftId,
          skyBonus: skyB,
          windBonus: fairLock
            ? 0
            : windBonusFromCatches(windCatchesRef.current),
          bluffLed: pickBluffLed(craftId, nextLayer, led),
        })
        animatingRef.current = false
      }
    }, delay)
  }, [
    state.phase,
    state.layer,
    state.multiplier,
    persistResult,
    enrichResult,
    noteWindCatch,
    windRisk,
  ])

  const cashOut = useCallback(() => {
    if (animatingRef.current) return
    if (state.phase !== 'climbing' || state.layer < 1) return
    animatingRef.current = true
    const craftId = craftRef.current
    const skinId = skinRef.current
    const challenge = challengeRef.current
    const blind = blindRef.current
    const fairLock = challenge || blind
    const skyB = fairLock ? 0 : skyBonusRef.current
    haptic.land(craftId)
    sfx.land(craftId)
    const near = getLayerInfo(state.layer + 1, craftId)
    const result = enrichResult({
      outcome: 'cashed',
      layer: state.layer,
      multiplier: state.multiplier,
      nearMissMultiplier: applySkyBonus(near.multiplier, skyB),
      timestamp: Date.now(),
      craftId,
      skinId,
      bombUsed: bombUsedRef.current,
      skyBonus: skyB,
      challenge,
      blind,
      weekly: weeklyRef.current,
      ufoShieldUsed: craftId === 'ufo' && !ufoShieldRef.current,
      eyeShieldUsed: eyeShieldUsedRef.current,
      smileCashOut: smileCashOutRef.current,
      windCatches: windCatchesRef.current || undefined,
      ...(stakeAssetRef.current && stakeAmountRef.current > 0
        ? {
            stakeAsset: stakeAssetRef.current,
            stakeAmount: stakeAmountRef.current,
            payoutAmount: roundAsset(
              stakeAmountRef.current * state.multiplier,
              stakeAssetRef.current,
            ),
          }
        : {}),
      ...(duelIdRef.current ? { duelId: duelIdRef.current } : {}),
      ...(chatBlindRef.current ? { chatBlind: true } : {}),
      ...(boostTableRef.current ? { boostTable: true } : {}),
      ...(starsStakeRef.current > 0
        ? { starsStake: starsStakeRef.current }
        : {}),
    })
    smileCashOutRef.current = false
    dispatch({ type: 'CASH_OUT', result })
    persistResult(result)
    window.setTimeout(() => {
      dispatch({ type: 'SET_PHASE', phase: 'done' })
      dispatch({ type: 'SET_SCREEN', screen: 'result' })
      animatingRef.current = false
    }, 900)
  }, [state.phase, state.layer, state.multiplier, persistResult, enrichResult])

  cashOutRef.current = cashOut

  const setAutoCashOut = useCallback((x: number) => {
    const allowed = AUTO_CASH_PRESETS as readonly number[]
    const profile = loadProfile()
    const next: PlayerProfile = {
      ...profile,
      autoCashOut: allowed.includes(x) ? x : 0,
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const doCheckIn = useCallback(() => {
    const res = claimCheckIn(loadProfile())
    if (!res.ok) {
      setRetentionHint(res.error)
      window.setTimeout(() => setRetentionHint(null), 2500)
      return false
    }
    saveProfile(res.profile)
    dispatch({ type: 'SET_PROFILE', profile: res.profile })
    setRetentionHint(res.message)
    haptic.unlock()
    window.setTimeout(() => setRetentionHint(null), 3500)
    return true
  }, [])

  const goHome = useCallback(() => {
    haptic.tap(craftRef.current)
    sfx.stopProp()
    sfx.stopStatic()
    dispatch({ type: 'RESET_TO_HOME' })
  }, [])

  const setScreen = useCallback(
    (screen: Screen) => {
      haptic.tap(craftRef.current)
      void sfx.unlock()
      dispatch({ type: 'SET_SCREEN', screen })
      if (screen === 'leaderboard') void refreshSync()
    },
    [refreshSync],
  )

  const hideTip = useCallback(() => dispatch({ type: 'HIDE_TIP' }), [])

  const rename = useCallback((name: string) => {
    dispatch({ type: 'RENAME', name: name.slice(0, 16) || 'Pilot' })
  }, [])

  const linkWallet = useCallback((address: string, verified: boolean) => {
    const profile = loadProfile()
    const next: PlayerProfile = {
      ...profile,
      walletAddress: address,
      walletVerified: verified,
      badges:
        verified && !profile.badges.includes('cuzdan-bagli')
          ? [...profile.badges, 'cuzdan-bagli']
          : profile.badges,
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
    void pushScore(next)
  }, [])

  const unlinkWallet = useCallback(() => {
    const profile = loadProfile()
    const next: PlayerProfile = {
      ...profile,
      walletAddress: null,
      walletVerified: false,
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const claimDemo = useCallback(() => {
    const profile = loadProfile()
    const res = claimDemoPack(profile)
    if (!res.ok) return res
    const next = { ...profile, ...res.profilePatch, balances: res.balances }
    if (!next.badges.includes('cuzdan-acildi')) {
      next.badges = [...next.badges, 'cuzdan-acildi']
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
    return res
  }, [])

  const deposit = useCallback((asset: AssetId, amount: number) => {
    const profile = loadProfile()
    const res = depositAsset(profile, asset, amount, profile.walletAddress ?? undefined)
    if (!res.ok) return res
    const next = { ...profile, ...res.profilePatch, balances: res.balances }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
    return res
  }, [])

  const withdraw = useCallback((asset: AssetId, amount: number, toAddress: string) => {
    const profile = loadProfile()
    const res = queueWithdraw(profile, asset, amount, toAddress)
    if (!res.ok) return res
    const next = { ...profile, ...res.profilePatch, balances: res.balances }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
    return res
  }, [])

  const cancelQueuedWithdraw = useCallback((requestId: string) => {
    const profile = loadProfile()
    const res = cancelWithdraw(profile, requestId)
    if (!res.ok) return res
    const next = { ...profile, ...res.profilePatch, balances: res.balances }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
    return res
  }, [])

  const creditChainDeposit = useCallback(
    (amount: number, signature: string, asset: 'sol' | 'usdc' = 'sol') => {
      const profile = loadProfile()
      const res = creditOnChainDeposit(profile, amount, signature, asset)
      if (!res.ok) return res
      const next = { ...profile, ...res.profilePatch, balances: res.balances }
      if (!next.badges.includes('onchain-yukle')) {
        next.badges = [...next.badges, 'onchain-yukle']
      }
      saveProfile(next)
      dispatch({ type: 'SET_PROFILE', profile: next })
      return res
    },
    [],
  )

  const setHighRoller = useCallback((on: boolean) => {
    const profile = loadProfile()
    const asset = on
      ? isAssetId(profile.payAsset) && !['usdt', 'usdc'].includes(profile.payAsset)
        ? profile.payAsset
        : 'sol'
      : ['usdt', 'usdc'].includes(profile.payAsset)
        ? profile.payAsset
        : 'usdc'
    const next: PlayerProfile = {
      ...profile,
      highRoller: on,
      payAsset: asset as typeof profile.payAsset,
      stakeAmount: on ? ASSETS[asset as AssetId].flightStake : 1,
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const setPayAsset = useCallback((asset: AssetId) => {
    const profile = loadProfile()
    const high = profile.highRoller
    if (!high && asset !== 'usdt' && asset !== 'usdc') {
      return
    }
    const next: PlayerProfile = {
      ...profile,
      payAsset: asset,
      stakeAmount: high ? ASSETS[asset].flightStake : 1,
      balances: normalizeBalances(profile.balances),
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const setPayWithCrypto = useCallback((on: boolean) => {
    const profile = loadProfile()
    const next: PlayerProfile = { ...profile, payWithCrypto: on }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const setStakeAmount = useCallback((amount: number) => {
    const profile = loadProfile()
    const asset = isAssetId(profile.payAsset) ? profile.payAsset : 'usdt'
    const next: PlayerProfile = {
      ...profile,
      stakeAmount: roundAsset(amount, asset),
    }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const selectCraft = useCallback((craftId: CraftId, skinId?: CraftSkinId) => {
    const profile = selectLoadout(loadProfile(), craftId, skinId)
    craftRef.current = profile.selectedCraft
    skinRef.current = profile.selectedSkin
    haptic.tap(profile.selectedCraft)
    dispatch({ type: 'SET_PROFILE', profile })
  }, [])

  const buyCraft = useCallback((craftId: CraftId, payWith: UnlockPayWith) => {
    const result = unlockCraft(loadProfile(), craftId, payWith)
    if (!result.ok) {
      dispatch({ type: 'HANGAR_MSG', message: result.reason })
      return false
    }
    haptic.unlock()
    dispatch({ type: 'SET_PROFILE', profile: result.profile })
    dispatch({
      type: 'HANGAR_MSG',
      message: `${CRAFTS[craftId].name} filosuna eklendi!`,
    })
    return true
  }, [])

  const buySkin = useCallback((skinId: CraftSkinId, payWith: UnlockPayWith = 'credits') => {
    const result = unlockSkin(loadProfile(), skinId, payWith)
    if (!result.ok) {
      dispatch({ type: 'HANGAR_MSG', message: result.reason })
      return false
    }
    haptic.unlock()
    dispatch({ type: 'SET_PROFILE', profile: result.profile })
    dispatch({ type: 'HANGAR_MSG', message: 'Skin açıldı!' })
    return true
  }, [])

  const purchaseBomb = useCallback(() => {
    const result = buyBomb(loadProfile())
    if (!result.ok) {
      dispatch({ type: 'HANGAR_MSG', message: result.reason })
      return false
    }
    haptic.unlock()
    dispatch({ type: 'SET_PROFILE', profile: result.profile })
    dispatch({ type: 'HANGAR_MSG', message: 'Sinyal bombası eklendi!' })
    return true
  }, [])

  const friendEntries = friendsToEntries(friends)
  const remoteEntries = friendsToEntries(remoteTop)
  const leaderboard = buildLeaderboard(state.profile, [
    ...friendEntries,
    ...remoteEntries,
  ])
  const youEntry = {
    id: 'you',
    name: `${state.profile.displayName} (Sen)`,
    bestMultiplier: state.profile.bestMultiplier || 0,
    bestLayer: state.profile.bestLayer || 0,
    streak: state.profile.streak,
    isYou: true as const,
  }
  const friendsLeaderboard = [...friendEntries, youEntry].sort(
    (a, b) => b.bestMultiplier - a.bestMultiplier,
  )
  const youDaily = {
    id: 'you',
    name: `${state.profile.displayName} (Sen)`,
    bestMultiplier: dailyBest?.bestMultiplier || 0,
    bestLayer: dailyBest?.bestLayer || 0,
    streak: state.profile.streak,
    isYou: true as const,
  }
  const dailyLeaderboard = [
    ...friendsToEntries(dailyBoard).filter((e) => e.id !== getOrCreatePilotId()),
    youDaily,
  ].sort((a, b) => b.bestMultiplier - a.bestMultiplier)

  const activeCraft = CRAFTS[state.profile.selectedCraft]
  const nextLayer = getLayerInfo(
    Math.max(1, state.layer + 1),
    state.profile.selectedCraft,
  )
  const previewNextMultiplier = applyWindBonus(
    applySkyBonus(
      nextLayer.multiplier,
      state.challengeMode || state.blindMode || state.weeklyMode
        ? 0
        : state.skyBonus,
    ),
    state.challengeMode || state.blindMode || state.weeklyMode
      ? 0
      : state.windBonus,
  )

  const displayLed = state.bluffLed ?? state.led

  const shareDaily = useCallback(async () => {
    const best = loadDailyBest()
    const text = best
      ? `Zincir: Drone — Bugünün meydan okuması: ${fmtX(best.bestMultiplier)} (K${best.bestLayer})`
      : `Zincir: Drone — Bugünün meydan okumasına katıl! ${location.href}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Zincir: Drone', text, url: location.href })
      } else {
        await navigator.clipboard.writeText(text)
        setSyncHint('Günlük skor kopyalandı')
        window.setTimeout(() => setSyncHint(null), 2200)
      }
    } catch {
      // cancelled
    }
  }, [])

  const shareInvite = useCallback(async () => {
    const card = profileToCard(loadProfile())
    const webUrl = friendInviteUrl(card)
    const tgUrl = telegramStartAppLink(card.id)
    const url = tgUrl || webUrl
    const text = `Zincir: Drone — ${card.name} seni filo'ya davet ediyor! Rekor ${fmtX(card.bestMultiplier)}`
    try {
      if (isTelegramMiniApp() && tgUrl) {
        tgShareUrl(tgUrl, text)
        setSyncHint('Telegram daveti açıldı')
        window.setTimeout(() => setSyncHint(null), 2200)
        return true
      }
      if (navigator.share) {
        await navigator.share({ title: 'Zincir: Drone Davet', text, url })
      } else {
        await navigator.clipboard.writeText(url)
        setSyncHint('Davet linki kopyalandı')
        window.setTimeout(() => setSyncHint(null), 2200)
      }
      return true
    } catch {
      return false
    }
  }, [])

  const copyPilotCode = useCallback(async () => {
    const id = getOrCreatePilotId()
    try {
      await navigator.clipboard.writeText(id)
      setSyncHint('Pilot kodu kopyalandı')
      window.setTimeout(() => setSyncHint(null), 2200)
      return true
    } catch {
      return false
    }
  }, [])

  const createDuel = useCallback(async () => {
    const id = newDuelId()
    setActiveDuelId(id)
    duelIdRef.current = id
    const url = duelInviteUrl(id)
    const query = `Zincir düello ${id}`
    if (isTelegramMiniApp()) {
      tgSwitchInlineQuery(query)
      if (url) tgShareUrl(url, 'Filo düellosu — aynı seed, kim daha yüksek iner?')
    } else if (url) {
      try {
        await navigator.clipboard.writeText(url)
        setRetentionHint('Düello linki kopyalandı')
        window.setTimeout(() => setRetentionHint(null), 2500)
      } catch {
        setRetentionHint(`Düello: ${id}`)
      }
    }
    return id
  }, [])

  const startDuelFlight = useCallback(() => {
    const id = activeDuelId || duelIdRef.current || newDuelId()
    setActiveDuelId(id)
    duelIdRef.current = id
    return startFlight({ duelId: id })
  }, [activeDuelId, startFlight])

  const startChatBlindFlight = useCallback(() => {
    const tok = pendingChatBlind || chatBlindToken()
    setPendingChatBlind(tok)
    chatBlindRef.current = tok
    return startFlight({ chatBlind: true, blind: true })
  }, [pendingChatBlind, startFlight])

  const startBoostFlight = useCallback(() => {
    if (!hasBoostAccess(boostUnlocked)) {
      setRetentionHint('Boost / Premium gerekli')
      window.setTimeout(() => setRetentionHint(null), 2500)
      return false
    }
    return startFlight({ boostTable: true })
  }, [boostUnlocked, startFlight])

  const setPayWithStars = useCallback((on: boolean) => {
    const profile = loadProfile()
    const next = { ...profile, payWithStars: on }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
  }, [])

  const purchaseStars = useCallback(async () => {
    const status = await buyStarsPack(STARS_WELCOME)
    if (status === 'paid' || status === 'demo') {
      const profile = loadProfile()
      const next: PlayerProfile = {
        ...profile,
        starsBalance: profile.starsBalance + STARS_WELCOME,
        badges: profile.badges.includes('stars-pilot')
          ? profile.badges
          : [...profile.badges, 'stars-pilot'],
      }
      saveProfile(next)
      dispatch({ type: 'SET_PROFILE', profile: next })
      setRetentionHint(
        status === 'demo'
          ? `+${STARS_WELCOME} Stars (demo)`
          : `+${STARS_WELCOME} Stars`,
      )
      window.setTimeout(() => setRetentionHint(null), 2800)
      return true
    }
    setRetentionHint(status === 'cancelled' ? 'Stars iptal' : 'Stars başarısız')
    window.setTimeout(() => setRetentionHint(null), 2500)
    return false
  }, [])

  const shareStory = useCallback(async () => {
    const result = state.result
    if (!result) return 'failed' as const
    const mode = await shareResultToStory(result, state.profile.displayName)
    if (mode === 'shared') {
      setRetentionHint('Story paylaşıldı')
      window.setTimeout(() => setRetentionHint(null), 2500)
    } else if (mode === 'unsupported') {
      setRetentionHint('Story bu istemcide yok')
      window.setTimeout(() => setRetentionHint(null), 2500)
    }
    return mode
  }, [state.result, state.profile.displayName])

  const shareChatBlind = useCallback(() => {
    const tok = pendingChatBlind || chatBlindToken()
    const url = chatBlindInviteUrl(tok)
    if (url) tgShareUrl(url, 'Chat kör uçuş — aynı seed, LED kapalı!')
    return url
  }, [pendingChatBlind])

  const claimSeason = useCallback(() => {
    const res = claimPassTier(loadProfile())
    saveProfile(res.profile)
    dispatch({ type: 'SET_PROFILE', profile: res.profile })
    setSeason(res.season)
    if (res.claimed.length) {
      setRetentionHint(
        `Sezon: ${res.claimed.map((t) => t.label).join(', ')}`,
      )
      haptic.unlock()
      window.setTimeout(() => setRetentionHint(null), 3200)
    } else {
      setRetentionHint('Henüz açılacak ödül yok')
      window.setTimeout(() => setRetentionHint(null), 2200)
    }
    return res.claimed.length > 0
  }, [])

  const announceWeekly = useCallback(() => {
    const channel = (
      import.meta.env.VITE_TELEGRAM_CHANNEL as string | undefined
    )?.replace(/^@/, '')
    const wk = weekKey()
    const best = loadWeeklyBest()
    const text = best
      ? `Zincir haftalık lig ${wk}: rekor ${fmtX(best.bestMultiplier)} (K${best.bestLayer})`
      : `Zincir haftalık lig ${wk} — katıl!`
    if (channel && isTelegramMiniApp()) {
      getWebApp().openTelegramLink(`https://t.me/${channel}`)
    }
    tgShareUrl(
      telegramStartAppLink(getOrCreatePilotId()) || location.href,
      text,
    )
  }, [])

  const completeSelfie = useCallback(() => {
    const result = state.result
    if (!result || result.outcome !== 'cashed' || result.selfieCaptured) {
      return false
    }
    const patched: FlightResult = { ...result, selfieCaptured: true }
    const profile = loadProfile()
    const badges = profile.badges.includes('selfie-pilot')
      ? profile.badges
      : [...profile.badges, 'selfie-pilot']
    const history = profile.history.map((h) =>
      h.timestamp === result.timestamp ? patched : h,
    )
    const next: PlayerProfile = { ...profile, badges, history }
    saveProfile(next)
    dispatch({ type: 'SET_PROFILE', profile: next })
    dispatch({ type: 'PATCH_RESULT', result: patched })
    haptic.unlock()
    setRetentionHint('Selfie Pilot rozeti!')
    window.setTimeout(() => setRetentionHint(null), 2800)
    return true
  }, [state.result])

  return {
    ...state,
    startFlight,
    climb,
    cashOut,
    armBomb,
    purchaseBomb,
    setSkySample,
    setFaceSample,
    setTiltSample,
    completeSelfie,
    claimSeason,
    announceWeekly,
    createDuel,
    startDuelFlight,
    startChatBlindFlight,
    startBoostFlight,
    setPayWithStars,
    purchaseStars,
    shareStory,
    shareChatBlind,
    activeDuelId,
    duelBoard,
    duelVerdictText: (() => {
      if (!activeDuelId || !duelBoard || !state.result?.duelId) return null
      const me = getOrCreatePilotId()
      const mine = duelBoard.scores.find((s) => s.pilotId === me)
      const other = duelBoard.scores.find((s) => s.pilotId !== me)
      if (!mine) return null
      return duelVerdict(mine, other)
    })(),
    pendingChatBlind,
    boostUnlocked,
    starsFlightCost: STARS_FLIGHT_COST,
    weeklyBest,
    weeklyBoard,
    weeklyLeaderboard: [
      ...weeklyBoard.map((e) => ({
        ...e,
        isYou: e.id === getOrCreatePilotId(),
      })),
      ...(weeklyBoard.some((e) => e.id === getOrCreatePilotId())
        ? []
        : [
            {
              id: getOrCreatePilotId(),
              name: `${state.profile.displayName} (Sen)`,
              bestMultiplier: weeklyBest?.bestMultiplier || 0,
              bestLayer: weeklyBest?.bestLayer || 0,
              streak: weeklyBest?.flights || 0,
              isYou: true as const,
            },
          ]),
    ].sort((a, b) => b.bestMultiplier - a.bestMultiplier),
    season,
    seasonProgress: seasonProgress(season),
    weekKey: weekKey(),
    daysLeftInWeek: daysLeftInWeek(),
    goHome,
    setScreen,
    hideTip,
    rename,
    linkWallet,
    unlinkWallet,
    claimDemo,
    deposit,
    withdraw,
    cancelQueuedWithdraw,
    creditChainDeposit,
    setPayAsset,
    setPayWithCrypto,
    setStakeAmount,
    setHighRoller,
    selectCraft,
    buyCraft,
    buySkin,
    addFriend,
    removeFriend,
    enableNotifications,
    disableNotifications,
    refreshSync,
    shareDaily,
    shareInvite,
    copyPilotCode,
    pilotId: getOrCreatePilotId(),
    setAutoCashOut,
    doCheckIn,
    canCheckInToday: canCheckIn(state.profile),
    checkInPreview: previewCheckIn(state.profile),
    retentionHint,
    fairCommit,
    notifOn,
    notifPermission: notifPermission(),
    dailyBest,
    syncHint,
    leaderboard,
    friendsLeaderboard,
    dailyLeaderboard,
    fmtX,
    formatSkyBonus,
    activeCraft,
    bombCost: BOMB_POINT_COST,
    previewNextMultiplier,
    displayLed,
  }
}

export type GameApi = ReturnType<typeof useGame>
