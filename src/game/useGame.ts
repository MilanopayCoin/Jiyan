import { useCallback, useEffect, useReducer, useRef } from 'react'
import { fmtX, getLayerInfo, getLedLevel, rollCrash } from './math'
import {
  applyFlightResult,
  buildLeaderboard,
  loadProfile,
  saveProfile,
} from './storage'
import type {
  FlightPhase,
  FlightResult,
  LedLevel,
  PlayerProfile,
  Screen,
} from './types'
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
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_PROFILE'; profile: PlayerProfile }
  | { type: 'START_FLIGHT' }
  | { type: 'CLIMB_SUCCESS'; layer: number }
  | { type: 'CRASH'; result: FlightResult }
  | { type: 'CASH_OUT'; result: FlightResult }
  | { type: 'SET_PHASE'; phase: FlightPhase }
  | { type: 'SHAKE_OFF' }
  | { type: 'FLASH_OFF' }
  | { type: 'HIDE_TIP' }
  | { type: 'RESET_TO_HOME' }
  | { type: 'RENAME'; name: string }

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
  }
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen }
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
      const info = getLayerInfo(action.layer)
      return {
        ...state,
        phase: 'climbing',
        layer: action.layer,
        multiplier: info.multiplier,
        led: getLedLevel(action.layer),
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
    default:
      return state
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const consecutiveRef = useRef(state.consecutiveSafe)
  const animatingRef = useRef(false)

  useEffect(() => {
    consecutiveRef.current = state.consecutiveSafe
  }, [state.consecutiveSafe])

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
    haptic.tap()
    dispatch({ type: 'START_FLIGHT' })
    // Auto climb to layer 1 after brief takeoff
    window.setTimeout(() => {
      if (rollCrash(1)) {
        const near = getLayerInfo(1)
        const result: FlightResult = {
          outcome: 'crashed',
          layer: 0,
          multiplier: 1,
          nearMissMultiplier: near.multiplier,
          timestamp: Date.now(),
        }
        haptic.crash()
        dispatch({ type: 'CRASH', result })
        persistResult(result)
        window.setTimeout(() => {
          dispatch({ type: 'SET_PHASE', phase: 'done' })
          dispatch({ type: 'SET_SCREEN', screen: 'result' })
          dispatch({ type: 'SHAKE_OFF' })
          dispatch({ type: 'FLASH_OFF' })
        }, 900)
      } else {
        haptic.climb()
        dispatch({ type: 'CLIMB_SUCCESS', layer: 1 })
      }
    }, 700)
    return true
  }, [persistResult])

  const climb = useCallback(() => {
    if (animatingRef.current) return
    if (state.phase !== 'climbing' || state.layer < 1) return
    animatingRef.current = true
    haptic.climb()

    const nextLayer = state.layer + 1
    window.setTimeout(() => {
      if (rollCrash(nextLayer)) {
        const near = getLayerInfo(nextLayer)
        const result: FlightResult = {
          outcome: 'crashed',
          layer: state.layer,
          multiplier: state.multiplier,
          nearMissMultiplier: near.multiplier,
          timestamp: Date.now(),
        }
        haptic.crash()
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
        dispatch({ type: 'CLIMB_SUCCESS', layer: nextLayer })
        animatingRef.current = false
      }
    }, 350)
  }, [state.phase, state.layer, state.multiplier, persistResult])

  const cashOut = useCallback(() => {
    if (animatingRef.current) return
    if (state.phase !== 'climbing' || state.layer < 1) return
    animatingRef.current = true
    haptic.land()
    const near = getLayerInfo(state.layer + 1)
    const result: FlightResult = {
      outcome: 'cashed',
      layer: state.layer,
      multiplier: state.multiplier,
      nearMissMultiplier: near.multiplier,
      timestamp: Date.now(),
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
    haptic.tap()
    dispatch({ type: 'RESET_TO_HOME' })
  }, [])

  const setScreen = useCallback((screen: Screen) => {
    haptic.tap()
    dispatch({ type: 'SET_SCREEN', screen })
  }, [])

  const hideTip = useCallback(() => dispatch({ type: 'HIDE_TIP' }), [])

  const rename = useCallback((name: string) => {
    dispatch({ type: 'RENAME', name: name.slice(0, 16) || 'Pilot' })
  }, [])

  const leaderboard = buildLeaderboard(state.profile)

  return {
    ...state,
    startFlight,
    climb,
    cashOut,
    goHome,
    setScreen,
    hideTip,
    rename,
    leaderboard,
    fmtX,
  }
}

export type GameApi = ReturnType<typeof useGame>
