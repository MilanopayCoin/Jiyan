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
  BOMB_CREDIT_COST,
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
  /** UFO may show a lying LED */
  bluffLed: LedLevel | null
  ufoShieldReady: boolean
  /** Front-camera eye-contact shield ready */
  eyeShieldReady: boolean
  gazeActive: boolean
  smileActive: boolean
  facePresent: boolean
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_PROFILE'; profile: PlayerProfile }
  | { type: 'START_FLIGHT'; challenge: boolean; blind: boolean }
  | {
      type: 'CLIMB_SUCCESS'
      layer: number
      craftId: CraftId
      skyBonus: number
      bluffLed: LedLevel | null
    }
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
    bluffLed: null,
    ufoShieldReady: false,
    eyeShieldReady: false,
    gazeActive: false,
    smileActive: false,
    facePresent: false,
  }
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen, hangarMessage: null }
    case 'SET_PROFILE':
      return { ...state, profile: action.profile }
    case 'SET_SKY': {
      const fairLock = state.challengeMode || state.blindMode
      const next = {
        ...state,
        skyScore: action.sample.score,
        skyBonus: fairLock ? 0 : action.sample.bonus,
        skyActive: fairLock ? false : action.sample.active,
      }
      if (!fairLock && state.phase === 'climbing' && state.layer >= 1) {
        next.multiplier = applySkyBonus(state.baseMultiplier, action.sample.bonus)
      }
      return next
    }
    case 'START_FLIGHT':
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
        bluffLed: null,
        ufoShieldReady: state.profile.selectedCraft === 'ufo',
        eyeShieldReady: !action.challenge && !action.blind,
        gazeActive: false,
        smileActive: false,
        facePresent: false,
        skyBonus: action.challenge || action.blind ? 0 : state.skyBonus,
        skyActive: action.challenge || action.blind ? false : state.skyActive,
      }
    case 'CLIMB_SUCCESS': {
      const info = getLayerInfo(action.layer, action.craftId)
      const sky =
        state.challengeMode || state.blindMode ? 0 : action.skyBonus
      const boosted = applySkyBonus(info.multiplier, sky)
      return {
        ...state,
        phase: 'climbing',
        layer: action.layer,
        baseMultiplier: info.multiplier,
        multiplier: boosted,
        led: getLedLevel(action.layer, action.craftId),
        bluffLed: action.bluffLed,
      }
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
        bluffLed: null,
        ufoShieldReady: false,
        eyeShieldReady: false,
        gazeActive: false,
        smileActive: false,
        facePresent: false,
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
    const [remoteFriends, daily, top] = await Promise.all([
      fetchFriendsRemote(ids),
      fetchDailyRemote(),
      fetchTopRemote(),
    ])
    if (remoteFriends.length) {
      for (const card of remoteFriends) upsertFriend(card)
      setFriends(loadFriends())
    }
    setDailyBoard(daily)
    setRemoteTop(top)
  }, [])

  useEffect(() => {
    getOrCreatePilotId()
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
      if (state.challengeMode || state.blindMode) {
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
    [state.challengeMode, state.blindMode],
  )

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

  const startFlight = useCallback(async (opts?: { challenge?: boolean; blind?: boolean }) => {
    const profile = loadProfile()
    let payAsset = isAssetId(profile.payAsset) ? profile.payAsset : 'usdc'
    if (!profile.highRoller && payAsset !== 'usdt' && payAsset !== 'usdc') {
      payAsset = 'usdc'
    }
    const tableStakes = profile.highRoller
      ? ASSETS[payAsset].stakes
      : [1, 5, 10]
    const stakeAmt =
      Number.isFinite(profile.stakeAmount) && profile.stakeAmount > 0
        ? roundAsset(profile.stakeAmount, payAsset)
        : profile.highRoller
          ? ASSETS[payAsset].flightStake
          : 1
    if (
      profile.payWithCrypto &&
      !tableStakes.some((o) => Math.abs(o - stakeAmt) < 1e-12)
    ) {
      // allow exact match only for table / high-roller presets
    }
    const useCrypto = canStakeCrypto(profile, payAsset, stakeAmt)

    if (!useCrypto && profile.flightCredits <= 0) return false

    const craftId = profile.selectedCraft
    const skinId = profile.selectedSkin
    const challenge = Boolean(opts?.challenge)
    const blind = Boolean(opts?.blind) && !challenge
    challengeRef.current = challenge
    blindRef.current = blind
    ufoShieldRef.current = craftId === 'ufo'
    eyeShieldRef.current = !challenge && !blind
    eyeShieldUsedRef.current = false
    smileCashOutRef.current = false
    gazeRef.current = false

    const fairSeed = challenge
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

    let spent: PlayerProfile = { ...profile }
    if (useCrypto) {
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
      spent = {
        ...spent,
        flightCredits: spent.flightCredits - 1,
      }
      stakeAssetRef.current = null
      stakeAmountRef.current = 0
    }
    saveProfile(spent)
    dispatch({ type: 'SET_PROFILE', profile: spent })

    void sfx.unlock()
    void requestTiltPermission()
    haptic.tap(craftId)
    sfx.climb(craftId)
    dispatch({ type: 'START_FLIGHT', challenge, blind })
    bombArmedRef.current = false
    bombUsedRef.current = false
    sfx.startProp(craftId)

    const takeoffMs = Math.round(700 / CRAFTS[craftId].climbVisual)
    const fairLock = () => challengeRef.current || blindRef.current
    const stakeMeta = () =>
      stakeAssetRef.current && stakeAmountRef.current > 0
        ? {
            stakeAsset: stakeAssetRef.current,
            stakeAmount: stakeAmountRef.current,
          }
        : {}

    window.setTimeout(() => {
      const rng = rngRef.current
      fairRollsRef.current += 1
      if (rollCrash(1, craftId, false, rng)) {
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
        haptic.climb(craftId)
        sfx.setPropLayer(1, craftId)
        const real = getLedLevel(1, craftId)
        dispatch({
          type: 'CLIMB_SUCCESS',
          layer: 1,
          craftId,
          skyBonus: fairLock() ? 0 : skyBonusRef.current,
          bluffLed: pickBluffLed(craftId, 1, real),
        })
      }
    }, takeoffMs)
    return true
  }, [persistResult, enrichResult])

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
    const fairLock = challenge || blind
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
      if (rollCrash(nextLayer, craftId, shielded, rngRef.current)) {
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
          eyeShieldUsed: eyeShieldUsedRef.current,
          ...(stakeAssetRef.current && stakeAmountRef.current > 0
            ? {
                stakeAsset: stakeAssetRef.current,
                stakeAmount: stakeAmountRef.current,
              }
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
        sfx.setPropLayer(nextLayer, craftId)
        const led = getLedLevel(nextLayer, craftId)
        sfx.setStatic(led === 'critical' ? 0.85 : led === 'caution' ? 0.4 : 0.1)
        dispatch({
          type: 'CLIMB_SUCCESS',
          layer: nextLayer,
          craftId,
          skyBonus: skyB,
          bluffLed: pickBluffLed(craftId, nextLayer, led),
        })
        animatingRef.current = false
      }
    }, delay)
  }, [state.phase, state.layer, state.multiplier, persistResult, enrichResult])

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
      ufoShieldUsed: craftId === 'ufo' && !ufoShieldRef.current,
      eyeShieldUsed: eyeShieldUsedRef.current,
      smileCashOut: smileCashOutRef.current,
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
  const previewNextMultiplier = applySkyBonus(
    nextLayer.multiplier,
    state.challengeMode || state.blindMode ? 0 : state.skyBonus,
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
    const url = friendInviteUrl(card)
    const text = `Zincir: Drone — ${card.name} seni filo'ya davet ediyor! Rekor ${fmtX(card.bestMultiplier)} · ${url}`
    try {
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
    completeSelfie,
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
    bombCost: BOMB_CREDIT_COST,
    previewNextMultiplier,
    displayLed,
  }
}

export type GameApi = ReturnType<typeof useGame>
