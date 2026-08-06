import { useCallback, useEffect, useReducer, useRef } from 'react'
import { fmtX, getLayerInfo, getLedLevel, rollCrash } from './math'
import {
  applyFlightResult,
  buildLeaderboard,
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
      }
    case 'CASH_OUT':
      return {
        ...state,
        phase: 'landing',
        result: action.result,
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
      }
    case 'RENAME': {
      const profile = { ...state.profile, displayName: action.name }
      saveProfile(profile)
      return { ...state, profile }
    }
    case 'HANGAR_MSG':
      return { ...state, hangarMessage: action.message }
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

  useEffect(() => {
    consecutiveRef.current = state.consecutiveSafe
  }, [state.consecutiveSafe])

  useEffect(() => {
    craftRef.current = state.profile.selectedCraft
    skinRef.current = state.profile.selectedSkin
  }, [state.profile.selectedCraft, state.profile.selectedSkin])

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

  const climb = useCallback(() => {
    if (animatingRef.current) return
    if (state.phase !== 'climbing' || state.layer < 1) return
    animatingRef.current = true
    const craftId = craftRef.current
    const skinId = skinRef.current
    haptic.climb(craftId)

    const nextLayer = state.layer + 1
    const delay = Math.round(350 / CRAFTS[craftId].climbVisual)

    window.setTimeout(() => {
      if (rollCrash(nextLayer, craftId)) {
        const near = getLayerInfo(nextLayer, craftId)
        const result: FlightResult = {
          outcome: 'crashed',
          layer: state.layer,
          multiplier: state.multiplier,
          nearMissMultiplier: near.multiplier,
          timestamp: Date.now(),
          craftId,
          skinId,
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

  const leaderboard = buildLeaderboard(state.profile)
  const activeCraft = CRAFTS[state.profile.selectedCraft]

  return {
    ...state,
    startFlight,
    climb,
    cashOut,
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
  }
}

export type GameApi = ReturnType<typeof useGame>
