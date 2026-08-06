/** Device orientation → normalized tilt for craft sway */

import { useEffect, useState } from 'react'

export interface TiltState {
  /** -1..1 left/right (gamma) */
  x: number
  /** -1..1 forward/back (beta) */
  y: number
  allowed: boolean
  supported: boolean
}

const ZERO: TiltState = { x: 0, y: 0, allowed: false, supported: false }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export async function requestTiltPermission(): Promise<boolean> {
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>
  }
  if (typeof DOE.requestPermission === 'function') {
    try {
      const r = await DOE.requestPermission()
      return r === 'granted'
    } catch {
      return false
    }
  }
  // Non-iOS: permission not required
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

export function useTilt(enabled: boolean): TiltState {
  const [tilt, setTilt] = useState<TiltState>(ZERO)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setTilt(ZERO)
      return
    }
    if (!('DeviceOrientationEvent' in window)) {
      setTilt({ ...ZERO, supported: false })
      return
    }

    let allowed = true
    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left/right -90..90, beta: front/back -180..180
      const gx = e.gamma ?? 0
      const by = e.beta ?? 0
      setTilt({
        x: clamp(gx / 35, -1, 1),
        y: clamp((by - 45) / 40, -1, 1),
        allowed,
        supported: true,
      })
    }

    ;(async () => {
      allowed = await requestTiltPermission()
      if (!allowed) {
        setTilt({ ...ZERO, supported: true, allowed: false })
        return
      }
      window.addEventListener('deviceorientation', onOrient, true)
    })()

    return () => {
      window.removeEventListener('deviceorientation', onOrient, true)
    }
  }, [enabled])

  return tilt
}
