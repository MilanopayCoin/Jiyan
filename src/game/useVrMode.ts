import { useCallback, useEffect, useReducer, useRef } from 'react'
import { VR_MODES, type VrModeId } from './modes'
import {
  applyKick,
  apexQuality,
  clampLook,
  createBall,
  inKickZone,
  isGrounded,
  stepBall,
  type BallState,
} from './vrPhysics'
import { haptic } from '../utils/haptics'
import { loadProfile, saveProfile } from './storage'
import type { PlayerProfile } from './types'

export type VrPhase = 'menu' | 'playing' | 'ended'

export interface VrResult {
  modeId: VrModeId
  outcome: 'cashed' | 'crashed' | 'scored'
  touches: number
  multiplier: number
  nearMiss: number
  perfects: number
  timestamp: number
}

interface VrState {
  phase: VrPhase
  modeId: VrModeId | null
  ball: BallState
  touches: number
  multiplier: number
  perfects: number
  looking: { lookX: number; lookY: number }
  result: VrResult | null
  message: string | null
  orientationOk: boolean
  lastTouchAt: number
}

type Action =
  | { type: 'SELECT'; modeId: VrModeId }
  | { type: 'START' }
  | { type: 'TICK'; ball: BallState; now: number }
  | { type: 'LOOK'; lookX: number; lookY: number }
  | { type: 'TOUCH'; ball: BallState; multiplier: number; perfect: boolean }
  | { type: 'CRASH'; result: VrResult }
  | { type: 'CASH'; result: VrResult }
  | { type: 'ORIENT'; ok: boolean }
  | { type: 'MSG'; message: string | null }
  | { type: 'EXIT' }

function initial(): VrState {
  return {
    phase: 'menu',
    modeId: null,
    ball: createBall(),
    touches: 0,
    multiplier: 1,
    perfects: 0,
    looking: { lookX: 0, lookY: 0 },
    result: null,
    message: null,
    orientationOk: false,
    lastTouchAt: 0,
  }
}

function nextMult(modeId: VrModeId, touches: number, perfect: boolean): number {
  const mode = VR_MODES[modeId]
  let m = mode.multStart + touches * mode.multStep
  if (perfect) m += mode.multStep * 0.5
  if (modeId === 'lasttouch' && perfect) m += 0.4
  return Number(m.toFixed(2))
}

function reducer(state: VrState, action: Action): VrState {
  switch (action.type) {
    case 'SELECT':
      return {
        ...initial(),
        phase: 'menu',
        modeId: action.modeId,
        orientationOk: state.orientationOk,
      }
    case 'START': {
      if (!state.modeId) return state
      const mode = VR_MODES[state.modeId]
      return {
        ...state,
        phase: 'playing',
        ball: createBall(),
        touches: 0,
        multiplier: mode.multStart,
        perfects: 0,
        result: null,
        message: null,
        lastTouchAt: performance.now(),
      }
    }
    case 'TICK':
      return { ...state, ball: action.ball }
    case 'LOOK':
      return {
        ...state,
        looking: { lookX: action.lookX, lookY: action.lookY },
      }
    case 'TOUCH':
      return {
        ...state,
        ball: action.ball,
        touches: state.touches + 1,
        multiplier: action.multiplier,
        perfects: state.perfects + (action.perfect ? 1 : 0),
        lastTouchAt: performance.now(),
        message: action.perfect ? 'PERFECT!' : null,
      }
    case 'CRASH':
    case 'CASH':
      return {
        ...state,
        phase: 'ended',
        result: action.result,
        message: null,
      }
    case 'ORIENT':
      return { ...state, orientationOk: action.ok }
    case 'MSG':
      return { ...state, message: action.message }
    case 'EXIT':
      return { ...initial(), orientationOk: state.orientationOk }
    default:
      return state
  }
}

function persistVrBest(result: VrResult) {
  const profile = loadProfile()
  const badges = new Set(profile.badges)
  if (result.touches >= 8) badges.add('messi-ayak')
  if (result.perfects >= 3) badges.add('last-touch-king')
  if (result.modeId === 'hattrick' && result.outcome === 'cashed' && result.multiplier >= 3) {
    badges.add('hattrick-pilot')
  }
  const next: PlayerProfile = {
    ...profile,
    bestMultiplier: Math.max(profile.bestMultiplier, result.multiplier),
    totalCashed:
      profile.totalCashed +
      (result.outcome === 'cashed' || result.outcome === 'scored'
        ? result.multiplier
        : 0),
    badges: Array.from(badges),
  }
  saveProfile(next)
  return next
}

export function useVrMode() {
  const [state, dispatch] = useReducer(reducer, undefined, initial)
  const ballRef = useRef(state.ball)
  const playingRef = useRef(false)
  const lookRef = useRef(state.looking)
  const modeRef = useRef(state.modeId)
  const touchesRef = useRef(0)
  const multRef = useRef(1)
  const lastTouchRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    ballRef.current = state.ball
  }, [state.ball])
  useEffect(() => {
    playingRef.current = state.phase === 'playing'
  }, [state.phase])
  useEffect(() => {
    lookRef.current = state.looking
  }, [state.looking])
  useEffect(() => {
    modeRef.current = state.modeId
  }, [state.modeId])
  useEffect(() => {
    touchesRef.current = state.touches
    multRef.current = state.multiplier
    lastTouchRef.current = state.lastTouchAt
  }, [state.touches, state.multiplier, state.lastTouchAt])

  const requestOrientation = useCallback(async () => {
    try {
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }
      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission()
        dispatch({ type: 'ORIENT', ok: res === 'granted' })
        return res === 'granted'
      }
      dispatch({ type: 'ORIENT', ok: true })
      return true
    } catch {
      dispatch({ type: 'ORIENT', ok: false })
      return false
    }
  }, [])

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 45
      const gamma = e.gamma ?? 0
      const { lookX, lookY } = clampLook(beta, gamma)
      dispatch({ type: 'LOOK', lookX, lookY })
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [])

  // Physics loop
  useEffect(() => {
    if (state.phase !== 'playing' || !state.modeId) return
    const mode = VR_MODES[state.modeId]
    let prev = performance.now()

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      if (!playingRef.current || !modeRef.current) return
      const dt = Math.min(0.033, (now - prev) / 1000)
      prev = now

      let ball = stepBall(ballRef.current, dt, mode.gravity)
      // Gyro drift influence (keepy / hattrick)
      ball.vx += lookRef.current.lookX * dt * (mode.id === 'keepy' ? 1.8 : 0.6)
      ball.x *= 0.999

      if (isGrounded(ball)) {
        const touches = touchesRef.current
        const mult = multRef.current
        const result: VrResult = {
          modeId: mode.id,
          outcome: 'crashed',
          touches,
          multiplier: 0,
          nearMiss: Number((mult + mode.multStep).toFixed(2)),
          perfects: 0,
          timestamp: Date.now(),
        }
        playingRef.current = false
        haptic.crash('drone')
        persistVrBest(result)
        dispatch({ type: 'CRASH', result })
        return
      }

      if (mode.maxAirMs && now - lastTouchRef.current > mode.maxAirMs) {
        // Soft drop pressure — increase fall
        ball.vy -= dt * 4
      }

      ballRef.current = ball
      dispatch({ type: 'TICK', ball, now })
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [state.phase, state.modeId])

  const selectMode = useCallback((modeId: VrModeId) => {
    dispatch({ type: 'SELECT', modeId })
  }, [])

  const start = useCallback(async () => {
    await requestOrientation()
    haptic.tap('drone')
    dispatch({ type: 'START' })
  }, [requestOrientation])

  const kick = useCallback(() => {
    if (!playingRef.current || !modeRef.current) return
    const mode = VR_MODES[modeRef.current]
    const ball = ballRef.current
    if (!inKickZone(ball, mode.hitForgive)) {
      dispatch({ type: 'MSG', message: 'Topa yetiş!' })
      window.setTimeout(() => dispatch({ type: 'MSG', message: null }), 500)
      haptic.warn()
      return
    }

    const apex = apexQuality(ball)
    const perfect =
      mode.id === 'lasttouch' ? apex > 0.72 : apex > 0.85 && Math.random() > 0.4
    const power =
      mode.id === 'lasttouch' ? 0.35 + apex * 0.9 : 0.55 + Math.random() * 0.25

    const look = lookRef.current
    const nextBall = applyKick(ball, power, look.lookX, look.lookY)
    const touches = touchesRef.current + 1
    const multiplier = nextMult(mode.id, touches, perfect)

    ballRef.current = nextBall
    haptic.climb(perfect ? 'rocket' : 'drone')
    dispatch({
      type: 'TOUCH',
      ball: nextBall,
      multiplier,
      perfect,
    })

    // Free Kick: one decisive shot after alignment
    if (mode.id === 'freefire' && touches >= 1) {
      const scored = Math.abs(look.lookX) > 0.35 && apex > 0.3
      const result: VrResult = {
        modeId: mode.id,
        outcome: scored ? 'scored' : 'crashed',
        touches,
        multiplier: scored ? multiplier : 0,
        nearMiss: scored ? multiplier + 0.8 : multiplier,
        perfects: perfect ? 1 : 0,
        timestamp: Date.now(),
      }
      playingRef.current = false
      if (scored) haptic.land('plane')
      else haptic.crash('drone')
      persistVrBest(result)
      dispatch({ type: scored ? 'CASH' : 'CRASH', result })
    }
  }, [])

  const cashOut = useCallback(() => {
    if (!playingRef.current || !modeRef.current) return
    if (touchesRef.current < 1) return
    const mode = VR_MODES[modeRef.current]
    const result: VrResult = {
      modeId: mode.id,
      outcome: 'cashed',
      touches: touchesRef.current,
      multiplier: multRef.current,
      nearMiss: Number((multRef.current + mode.multStep).toFixed(2)),
      perfects: state.perfects,
      timestamp: Date.now(),
    }
    playingRef.current = false
    haptic.land('drone')
    persistVrBest(result)
    dispatch({ type: 'CASH', result })
  }, [state.perfects])

  const exit = useCallback(() => {
    playingRef.current = false
    dispatch({ type: 'EXIT' })
  }, [])

  return {
    ...state,
    mode: state.modeId ? VR_MODES[state.modeId] : null,
    selectMode,
    start,
    kick,
    cashOut,
    exit,
    requestOrientation,
  }
}

export type VrModeApi = ReturnType<typeof useVrMode>
