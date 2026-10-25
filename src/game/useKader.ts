import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applySpin,
  drawCard,
  fmtMult,
  loadKaderBest,
  resolveBreak,
  saveKaderBest,
  sumMultiplier,
  type ChainLink,
  type KaderCard,
  type KaderPhase,
  type KaderResult,
} from './kader'
import { haptic } from '../utils/haptics'

const BREAK_MS = 3000
const SPIN_MS = 900

export interface KaderApi {
  phase: KaderPhase
  links: ChainLink[]
  shields: number
  multiplier: number
  spinningCard: KaderCard | null
  lastCard: KaderCard | null
  breakMsLeft: number
  best: number
  result: KaderResult | null
  demoNote: string
  startRun: () => void
  spin: () => void
  lock: () => void
  keepBreak: (side: 'head' | 'tail') => void
  reset: () => void
  fmtMult: typeof fmtMult
}

export function useKader(): KaderApi {
  const [phase, setPhase] = useState<KaderPhase>('idle')
  const [links, setLinks] = useState<ChainLink[]>([])
  const [shields, setShields] = useState(0)
  const [spinningCard, setSpinningCard] = useState<KaderCard | null>(null)
  const [lastCard, setLastCard] = useState<KaderCard | null>(null)
  const [breakMsLeft, setBreakMsLeft] = useState(0)
  const [best, setBest] = useState(() => loadKaderBest())
  const [result, setResult] = useState<KaderResult | null>(null)

  const breakTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linksRef = useRef(links)
  const shieldsRef = useRef(shields)
  linksRef.current = links
  shieldsRef.current = shields

  const clearBreakTimer = useCallback(() => {
    if (breakTimer.current) {
      clearInterval(breakTimer.current)
      breakTimer.current = null
    }
  }, [])

  const clearSpinTimer = useCallback(() => {
    if (spinTimer.current) {
      clearTimeout(spinTimer.current)
      spinTimer.current = null
    }
  }, [])

  useEffect(() => () => {
    clearBreakTimer()
    clearSpinTimer()
  }, [clearBreakTimer, clearSpinTimer])

  const finishCrash = useCallback((chain: ChainLink[]) => {
    clearBreakTimer()
    const mult = sumMultiplier(chain)
    setPhase('crashed')
    setResult({
      outcome: 'crashed',
      multiplier: mult,
      links: chain.length,
      timestamp: Date.now(),
    })
    haptic.crash('drone')
  }, [clearBreakTimer])

  const finishLock = useCallback((chain: ChainLink[]) => {
    clearBreakTimer()
    const mult = sumMultiplier(chain)
    const nextBest = saveKaderBest(mult)
    setBest(nextBest)
    setPhase('locked')
    setResult({
      outcome: 'locked',
      multiplier: mult,
      links: chain.length,
      timestamp: Date.now(),
    })
    haptic.land('drone')
  }, [clearBreakTimer])

  const startBreakClock = useCallback(() => {
    clearBreakTimer()
    setBreakMsLeft(BREAK_MS)
    const started = Date.now()
    breakTimer.current = setInterval(() => {
      const left = BREAK_MS - (Date.now() - started)
      if (left <= 0) {
        clearBreakTimer()
        setBreakMsLeft(0)
        // Auto: keep the longer-value side
        const chain = linksRef.current
        const head = resolveBreak(chain, 'head')
        const tail = resolveBreak(chain, 'tail')
        const keep =
          sumMultiplier(head) >= sumMultiplier(tail) ? 'head' : 'tail'
        const next = resolveBreak(chain, keep)
        setLinks(next)
        linksRef.current = next
        setPhase('choice')
        return
      }
      setBreakMsLeft(left)
    }, 50)
  }, [clearBreakTimer])

  const startRun = useCallback(() => {
    clearBreakTimer()
    clearSpinTimer()
    setLinks([])
    setShields(0)
    setSpinningCard(null)
    setLastCard(null)
    setResult(null)
    setBreakMsLeft(0)
    setPhase('choice') // ready for first spin (empty chain)
    linksRef.current = []
    shieldsRef.current = 0
  }, [clearBreakTimer, clearSpinTimer])

  const spin = useCallback(() => {
    if (phase !== 'choice' && phase !== 'idle') return
    if (phase === 'idle') {
      startRun()
    }
    clearSpinTimer()
    setPhase('spinning')
    const card = drawCard(linksRef.current.length)
    setSpinningCard(card)

    spinTimer.current = setTimeout(() => {
      const applied = applySpin({
        links: linksRef.current,
        shields: shieldsRef.current,
        card,
      })
      setLinks(applied.links)
      setShields(applied.shields)
      linksRef.current = applied.links
      shieldsRef.current = applied.shields
      setLastCard(card)
      setSpinningCard(null)

      if (applied.phase === 'crashed') {
        finishCrash(applied.links)
        return
      }
      if (applied.phase === 'break') {
        setPhase('break')
        startBreakClock()
        return
      }
      setPhase('choice')
      haptic.tap('drone')
    }, SPIN_MS)
  }, [
    phase,
    startRun,
    clearSpinTimer,
    finishCrash,
    startBreakClock,
  ])

  const lock = useCallback(() => {
    if (phase !== 'choice') return
    if (linksRef.current.length === 0) return
    finishLock(linksRef.current)
  }, [phase, finishLock])

  const keepBreak = useCallback(
    (side: 'head' | 'tail') => {
      if (phase !== 'break') return
      clearBreakTimer()
      setBreakMsLeft(0)
      const next = resolveBreak(linksRef.current, side)
      setLinks(next)
      linksRef.current = next
      setPhase('choice')
      haptic.tap('drone')
    },
    [phase, clearBreakTimer],
  )

  const reset = useCallback(() => {
    clearBreakTimer()
    clearSpinTimer()
    setPhase('idle')
    setLinks([])
    setShields(0)
    setSpinningCard(null)
    setLastCard(null)
    setResult(null)
    setBreakMsLeft(0)
    linksRef.current = []
    shieldsRef.current = 0
  }, [clearBreakTimer, clearSpinTimer])

  return {
    phase,
    links,
    shields,
    multiplier: sumMultiplier(links),
    spinningCard,
    lastCard,
    breakMsLeft,
    best,
    result,
    demoNote: 'Ücretsiz demo · gerçek bahis yok',
    startRun,
    spin,
    lock,
    keepBreak,
    reset,
    fmtMult,
  }
}
