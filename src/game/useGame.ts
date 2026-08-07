import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { fmtX, getLayerInfo, getLedLevel, rollCrash, todayKey } from './math'
import {
  createRng,
  dailyChallengeSeed,
  loadDailyBest,
  updateDailyBestFromFlight,
  type DailyBest,
} from './challenge'
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
import { haptic } from '../utils/haptics'
import { sfx } from '../utils/audio'
import {
  applySkyBonus,
  formatSkyBonus,
  type SkySample,
} from '../utils/skyDetect'
import {
  consumeFriendFromUrl,
  friendsToEntries,
  getOrCreatePilotId,
  loadFriends,
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
  | { type: 'SHIELD_FLASH_OFF' }
  | { type: 'SET_SKY'; sample: SkySample }

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
  const rngRef = useRef<() => number>(Math.random)

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
    if (imported) setFriends(loadFriends())
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

  const setSkySample = useCallback((sample: SkySample) => {
    const wasActive = skyActiveRef.current
    dispatch({ type: 'SET_SKY', sample })
    if (!wasActive && sample.active) {
      haptic.warn()
      sfx.warn()
    }
  }, [])

  const persistResult = useCallback((result: FlightResult) => {
    const before = loadProfile()
    const { profile, consecutiveSafe } = applyFlightResult(
      before,
      result,
      consecutiveRef.current,
    )
    consecutiveRef.current = consecutiveSafe
    dispatch({ type: 'SET_PROFILE', profile })

    if (result.challenge) {
      const best = updateDailyBestFromFlight(
        result.multiplier,
        result.layer,
        result.craftId,
        result.outcome,
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
    if (result.outcome === 'cashed') {
      void notifySafeLanding(fmtX(result.multiplier))
    }

    void pushScore(profile).then((ok) => {
      if (ok) void refreshSync()
    })
    return consecutiveSafe
  }, [refreshSync])

  const addFriend = useCallback((card: FriendCard) => {
    const me = getOrCreatePilotId()
    if (card.id === me) return false
    setFriends(upsertFriend(card, me))
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

  const startFlight = useCallback((opts?: { challenge?: boolean; blind?: boolean }) => {
    const profile = loadProfile()
    if (profile.flightCredits <= 0) return false

    const craftId = profile.selectedCraft
    const skinId = profile.selectedSkin
    const challenge = Boolean(opts?.challenge)
    const blind = Boolean(opts?.blind) && !challenge
    challengeRef.current = challenge
    blindRef.current = blind
    ufoShieldRef.current = craftId === 'ufo'
    rngRef.current = challenge
      ? createRng(dailyChallengeSeed(todayKey(), craftId))
      : Math.random

    const spent: PlayerProfile = {
      ...profile,
      flightCredits: profile.flightCredits - 1,
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

    window.setTimeout(() => {
      const rng = rngRef.current
      if (rollCrash(1, craftId, false, rng)) {
        // UFO phase shield can absorb even takeoff crash
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
        const result: FlightResult = {
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
        }
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
  }, [persistResult])

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
      if (rollCrash(nextLayer, craftId, shielded, rngRef.current)) {
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
        const result: FlightResult = {
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
        }
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
  }, [state.phase, state.layer, state.multiplier, persistResult])

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
    const result: FlightResult = {
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
    }
    dispatch({ type: 'CASH_OUT', result })
    persistResult(result)
    window.setTimeout(() => {
      dispatch({ type: 'SET_PHASE', phase: 'done' })
      dispatch({ type: 'SET_SCREEN', screen: 'result' })
      animatingRef.current = false
    }, 900)
  }, [state.phase, state.layer, state.multiplier, persistResult])

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

  return {
    ...state,
    startFlight,
    climb,
    cashOut,
    armBomb,
    purchaseBomb,
    setSkySample,
    goHome,
    setScreen,
    hideTip,
    rename,
    selectCraft,
    buyCraft,
    buySkin,
    addFriend,
    removeFriend,
    enableNotifications,
    disableNotifications,
    refreshSync,
    shareDaily,
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
