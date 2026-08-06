import { useCallback, useEffect, useReducer, useRef } from 'react'
import { fmtX, getLayerInfo, getLedLevel, rollCrash } from './math'
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

interface GameState {
  screen: Screen
  profile: PlayerProfile
  phase: FlightPhase
  layer: number
  multiplier: number
  led: LedLevel
  shaking: boolean
  flash: boolean
  result: FlightResult | null
  consecutiveSafe: number
  tipVisible: boolean
  hangarMessage: string | null
  /** Next climb is crash-immune */
  bombArmed: boolean
  /** Bomb was consumed this flight */
  bombUsedThisFlight: boolean
  shieldFlash: boolean
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_PROFILE'; profile: PlayerProfile }
  | { type: 'START_FLIGHT' }
  | { type: 'CLIMB_SUCCESS'; layer: number; craftId: CraftId }
  | { type: 'CRASH'; result: FlightResult }
  | { type: 'CASH_OUT'; result: FlightResult }
  | { type: 'SET_PHASE'; phase: FlightPhase }
  | { type: 'SHAKE_OFF' }
  | { type: 'FLASH_OFF' }
  | { type: 'HIDE_TIP' }
  | { type: 'RESET_TO_HOME' }
  | { type: 'RENAME'; name: string }
  | { type: 'HANGAR_MSG'; message: string | null }
  | { type: 'ARM_BOMB' }
  | { type: 'CONSUME_SHIELD' }
  | { type: 'SHIELD_FLASH_OFF' }

function initialState(): GameState {
  const profile = loadProfile()
  return {
    screen: 'home',
    profile,
    phase: 'idle',
    layer: 0,
    multiplier: 1,
    led: 'safe',
    shaking: false,
    flash: false,
    result: null,
    consecutiveSafe: 0,
    tipVisible: true,
    hangarMessage: null,
    bombArmed: false,
    bombUsedThisFlight: false,
    shieldFlash: false,
  }
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen, hangarMessage: null }
    case 'SET_PROFILE':
      return { ...state, profile: action.profile }
    case 'START_FLIGHT':
      return {
        ...state,
        screen: 'flight',
        phase: 'climbing',
        layer: 0,
        multiplier: 1,
        led: 'safe',
        shaking: false,
        flash: false,
        result: null,
        bombArmed: false,
        bombUsedThisFlight: false,
        shieldFlash: false,
      }
    case 'CLIMB_SUCCESS': {
      const info = getLayerInfo(action.layer, action.craftId)
      return {
        ...state,
        phase: 'climbing',
        layer: action.layer,
        multiplier: info.multiplier,
        led: getLedLevel(action.layer, action.craftId),
      }
    }
    case 'CRASH':
      return {
        ...state,
        phase: 'crashing',
        shaking: true,
        flash: true,
        result: action.result,
        led: 'critical',
        bombArmed: false,
      }
    case 'CASH_OUT':
      return {
        ...state,
        phase: 'landing',
        result: action.result,
        bombArmed: false,
      }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SHAKE_OFF':
      return { ...state, shaking: false }
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
        led: 'safe',
        shaking: false,
        flash: false,
        result: null,
        bombArmed: false,
        bombUsedThisFlight: false,
        shieldFlash: false,
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
    case 'SHIELD_FLASH_OFF':
      return { ...state, shieldFlash: false }
    default:
      return state
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const consecutiveRef = useRef(state.consecutiveSafe)
  const animatingRef = useRef(false)
  const craftRef = useRef(state.profile.selectedCraft)
  const skinRef = useRef(state.profile.selectedSkin)
  const bombArmedRef = useRef(false)
  const bombUsedRef = useRef(false)

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

  const persistResult = useCallback((result: FlightResult) => {
    const { profile, consecutiveSafe } = applyFlightResult(
      loadProfile(),
      result,
      consecutiveRef.current,
    )
    consecutiveRef.current = consecutiveSafe
    dispatch({ type: 'SET_PROFILE', profile })
    return consecutiveSafe
  }, [])

  const startFlight = useCallback(() => {
    const profile = loadProfile()
    if (profile.flightCredits <= 0) return false

    const craftId = profile.selectedCraft
    const skinId = profile.selectedSkin

    const spent: PlayerProfile = {
      ...profile,
      flightCredits: profile.flightCredits - 1,
    }
    saveProfile(spent)
    dispatch({ type: 'SET_PROFILE', profile: spent })

    haptic.tap(craftId)
    dispatch({ type: 'START_FLIGHT' })
    bombArmedRef.current = false
    bombUsedRef.current = false

    const takeoffMs = Math.round(700 / CRAFTS[craftId].climbVisual)

    window.setTimeout(() => {
      if (rollCrash(1, craftId)) {
        const near = getLayerInfo(1, craftId)
        const result: FlightResult = {
          outcome: 'crashed',
          layer: 0,
          multiplier: 1,
          nearMissMultiplier: near.multiplier,
          timestamp: Date.now(),
          craftId,
          skinId,
          bombUsed: false,
        }
        haptic.crash(craftId)
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
        dispatch({ type: 'CLIMB_SUCCESS', layer: 1, craftId })
      }
    }, takeoffMs)
    return true
  }, [persistResult])

  const armBomb = useCallback(() => {
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
    window.setTimeout(() => dispatch({ type: 'SHIELD_FLASH_OFF' }), 600)
    return true
  }, [state.phase, state.layer, state.bombArmed])

  const climb = useCallback(() => {
    if (animatingRef.current) return
    if (state.phase !== 'climbing' || state.layer < 1) return
    animatingRef.current = true
    const craftId = craftRef.current
    const skinId = skinRef.current
    const shielded = bombArmedRef.current
    haptic.climb(craftId)

    const nextLayer = state.layer + 1
    const delay = Math.round(350 / CRAFTS[craftId].climbVisual)

    if (shielded) {
      dispatch({ type: 'CONSUME_SHIELD' })
      bombArmedRef.current = false
    }

    window.setTimeout(() => {
      if (rollCrash(nextLayer, craftId, shielded)) {
        const near = getLayerInfo(nextLayer, craftId)
        const result: FlightResult = {
          outcome: 'crashed',
          layer: state.layer,
          multiplier: state.multiplier,
          nearMissMultiplier: near.multiplier,
          timestamp: Date.now(),
          craftId,
          skinId,
          bombUsed: bombUsedRef.current,
        }
        haptic.crash(craftId)
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
        dispatch({ type: 'CLIMB_SUCCESS', layer: nextLayer, craftId })
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
    haptic.land(craftId)
    const near = getLayerInfo(state.layer + 1, craftId)
    const result: FlightResult = {
      outcome: 'cashed',
      layer: state.layer,
      multiplier: state.multiplier,
      nearMissMultiplier: near.multiplier,
      timestamp: Date.now(),
      craftId,
      skinId,
      bombUsed: bombUsedRef.current,
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
    dispatch({ type: 'RESET_TO_HOME' })
  }, [])

  const setScreen = useCallback((screen: Screen) => {
    haptic.tap(craftRef.current)
    dispatch({ type: 'SET_SCREEN', screen })
  }, [])

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

  const leaderboard = buildLeaderboard(state.profile)
  const activeCraft = CRAFTS[state.profile.selectedCraft]

  return {
    ...state,
    startFlight,
    climb,
    cashOut,
    armBomb,
    purchaseBomb,
    goHome,
    setScreen,
    hideTip,
    rename,
    selectCraft,
    buyCraft,
    buySkin,
    leaderboard,
    fmtX,
    activeCraft,
    bombCost: BOMB_CREDIT_COST,
  }
}

export type GameApi = ReturnType<typeof useGame>
