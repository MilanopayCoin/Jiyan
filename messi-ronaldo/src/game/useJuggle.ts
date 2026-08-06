import { useCallback, useEffect, useReducer, useRef } from 'react'
import { MODES, PLAYERS, type ModeId, type Phase, type PlayerId } from './roster'
import {
  apexQuality,
  applyKick,
  clampTilt,
  createBall,
  inKickZone,
  isGrounded,
  stepBall,
  type BallState,
} from './physics'

export interface RunResult {
  playerId: PlayerId
  modeId: ModeId
  outcome: 'cashed' | 'crashed'
  touches: number
  multiplier: number
  nearMiss: number
  perfects: number
}

interface State {
  phase: Phase
  playerId: PlayerId
  modeId: ModeId
  ball: BallState
  touches: number
  multiplier: number
  perfects: number
  tilt: { tiltX: number; tiltY: number }
  result: RunResult | null
  flash: string | null
}

type Action =
  | { type: 'SET_PLAYER'; id: PlayerId }
  | { type: 'SET_MODE'; id: ModeId }
  | { type: 'START' }
  | { type: 'TICK'; ball: BallState }
  | { type: 'TILT'; tiltX: number; tiltY: number }
  | { type: 'TOUCH'; ball: BallState; multiplier: number; perfect: boolean }
  | { type: 'END'; result: RunResult }
  | { type: 'FLASH'; text: string | null }
  | { type: 'MENU' }

function initial(): State {
  return {
    phase: 'menu',
    playerId: 'messi',
    modeId: 'hattrick',
    ball: createBall(),
    touches: 0,
    multiplier: 1,
    perfects: 0,
    tilt: { tiltX: 0, tiltY: 0 },
    result: null,
    flash: null,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, playerId: action.id }
    case 'SET_MODE':
      return { ...state, modeId: action.id }
    case 'START':
      return {
        ...state,
        phase: 'playing',
        ball: createBall(),
        touches: 0,
        multiplier: MODES[state.modeId].multStart,
        perfects: 0,
        result: null,
        flash: null,
      }
    case 'TICK':
      return { ...state, ball: action.ball }
    case 'TILT':
      return { ...state, tilt: { tiltX: action.tiltX, tiltY: action.tiltY } }
    case 'TOUCH':
      return {
        ...state,
        ball: action.ball,
        touches: state.touches + 1,
        multiplier: action.multiplier,
        perfects: state.perfects + (action.perfect ? 1 : 0),
        flash: action.perfect ? 'PERFECT!' : null,
      }
    case 'END':
      return { ...state, phase: 'result', result: action.result, flash: null }
    case 'FLASH':
      return { ...state, flash: action.text }
    case 'MENU':
      return { ...initial(), playerId: state.playerId, modeId: state.modeId }
    default:
      return state
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* ignore */
  }
}

export function useJuggle() {
  const [state, dispatch] = useReducer(reducer, undefined, initial)
  const ballRef = useRef(state.ball)
  const playingRef = useRef(false)
  const tiltRef = useRef(state.tilt)
  const metaRef = useRef({
    playerId: state.playerId,
    modeId: state.modeId,
    touches: 0,
    multiplier: 1,
    perfects: 0,
  })

  useEffect(() => {
    ballRef.current = state.ball
  }, [state.ball])
  useEffect(() => {
    playingRef.current = state.phase === 'playing'
  }, [state.phase])
  useEffect(() => {
    tiltRef.current = state.tilt
  }, [state.tilt])
  useEffect(() => {
    metaRef.current = {
      playerId: state.playerId,
      modeId: state.modeId,
      touches: state.touches,
      multiplier: state.multiplier,
      perfects: state.perfects,
    }
  }, [
    state.playerId,
    state.modeId,
    state.touches,
    state.multiplier,
    state.perfects,
  ])

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      const { tiltX, tiltY } = clampTilt(e.beta ?? 45, e.gamma ?? 0)
      dispatch({ type: 'TILT', tiltX, tiltY })
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [])

  useEffect(() => {
    if (state.phase !== 'playing') return
    const mode = MODES[state.modeId]
    let prev = performance.now()
    let raf = 0

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!playingRef.current) return
      const dt = Math.min(0.033, (now - prev) / 1000)
      prev = now

      let ball = stepBall(ballRef.current, dt, mode.gravity)
      ball.vx += tiltRef.current.tiltX * dt * (mode.id === 'keepy' ? 1.9 : 0.7)

      if (isGrounded(ball)) {
        const m = metaRef.current
        playingRef.current = false
        vibrate([40, 30, 80])
        dispatch({
          type: 'END',
          result: {
            playerId: m.playerId,
            modeId: m.modeId,
            outcome: 'crashed',
            touches: m.touches,
            multiplier: 0,
            nearMiss: Number(
              (m.multiplier + MODES[m.modeId].multStep).toFixed(2),
            ),
            perfects: m.perfects,
          },
        })
        return
      }

      ballRef.current = ball
      dispatch({ type: 'TICK', ball })
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state.phase, state.modeId])

  const setPlayer = useCallback((id: PlayerId) => {
    dispatch({ type: 'SET_PLAYER', id })
  }, [])
  const setMode = useCallback((id: ModeId) => {
    dispatch({ type: 'SET_MODE', id })
  }, [])

  const start = useCallback(async () => {
    try {
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>
      }
      if (typeof DOE.requestPermission === 'function') {
        await DOE.requestPermission()
      }
    } catch {
      /* desktop ok */
    }
    vibrate(12)
    dispatch({ type: 'START' })
  }, [])

  const kick = useCallback(() => {
    if (!playingRef.current) return
    const player = PLAYERS[metaRef.current.playerId]
    const mode = MODES[metaRef.current.modeId]
    const ball = ballRef.current

    if (!inKickZone(ball, player.forgive)) {
      dispatch({ type: 'FLASH', text: 'Topa yetiş!' })
      window.setTimeout(() => dispatch({ type: 'FLASH', text: null }), 450)
      vibrate(10)
      return
    }

    const apex = apexQuality(ball) + player.timingBoost
    const perfect =
      mode.id === 'lasttouch' ? apex > 0.75 : apex > 0.88 && Math.random() > 0.45
    const power =
      mode.id === 'lasttouch'
        ? 0.35 + Math.min(1, apex) * 0.85
        : 0.55 + Math.random() * 0.25
    const powerBoost = player.id === 'ronaldo' ? 0.35 : 0.08

    const next = applyKick(ball, power, tiltRef.current.tiltX, powerBoost)
    const touches = metaRef.current.touches + 1
    let multiplier =
      mode.multStart + touches * mode.multStep + (perfect ? mode.multStep * 0.5 : 0)
    if (mode.id === 'lasttouch' && perfect) multiplier += 0.4
    multiplier = Number(multiplier.toFixed(2))

    ballRef.current = next
    vibrate(perfect ? [20, 20, 40] : [16, 20, 16])
    dispatch({ type: 'TOUCH', ball: next, multiplier, perfect })
    if (perfect) {
      window.setTimeout(() => dispatch({ type: 'FLASH', text: null }), 500)
    }
  }, [])

  const cashOut = useCallback(() => {
    if (!playingRef.current || metaRef.current.touches < 1) return
    const m = metaRef.current
    playingRef.current = false
    vibrate([30, 20, 50])
    dispatch({
      type: 'END',
      result: {
        playerId: m.playerId,
        modeId: m.modeId,
        outcome: 'cashed',
        touches: m.touches,
        multiplier: m.multiplier,
        nearMiss: Number((m.multiplier + MODES[m.modeId].multStep).toFixed(2)),
        perfects: m.perfects,
      },
    })
  }, [])

  const toMenu = useCallback(() => dispatch({ type: 'MENU' }), [])

  return {
    ...state,
    player: PLAYERS[state.playerId],
    mode: MODES[state.modeId],
    setPlayer,
    setMode,
    start,
    kick,
    cashOut,
    toMenu,
  }
}

export type JuggleApi = ReturnType<typeof useJuggle>
