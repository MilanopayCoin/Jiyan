import { useEffect, useRef, useState } from 'react'
import { requestFrontCamera, stopStream } from '../utils/frontCamera'
import {
  EMPTY_FACE,
  SELFIE_HOLD_MS,
  sampleFaceFromVideo,
  type FaceSample,
} from '../utils/faceSense'
import type { CameraStatus } from '../utils/camera'

interface Props {
  active: boolean
  /** Larger selfie capture mode on result */
  selfieMode?: boolean
  selfieProgressMs?: number
  onSample?: (sample: FaceSample) => void
  onSelfieComplete?: (video: HTMLVideoElement) => void
  className?: string
}

export function FrontFaceOverlay({
  active,
  selfieMode = false,
  selfieProgressMs = SELFIE_HOLD_MS,
  onSample,
  onSelfieComplete,
  className = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onSampleRef = useRef(onSample)
  const onSelfieRef = useRef(onSelfieComplete)
  onSampleRef.current = onSample
  onSelfieRef.current = onSelfieComplete

  const [status, setStatus] = useState<CameraStatus>('pending')
  const [holdMs, setHoldMs] = useState(0)
  const faceHoldRef = useRef(0)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      stopStream(streamRef.current)
      streamRef.current = null
      setStatus('pending')
      onSampleRef.current?.(EMPTY_FACE)
      return
    }

    let cancelled = false
    ;(async () => {
      const { status: s, stream } = await requestFrontCamera()
      if (cancelled) {
        stopStream(stream)
        return
      }
      streamRef.current = stream
      setStatus(s)
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch {
          // wait for gesture
        }
      }
      if (s !== 'active') onSampleRef.current?.(EMPTY_FACE)
    })()

    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [active])

  useEffect(() => {
    if (!active || status !== 'active') return
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')

    let raf = 0
    let last = 0
    completedRef.current = false
    faceHoldRef.current = 0
    setHoldMs(0)

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 200) return
      const dt = last ? t - last : 200
      last = t
      const video = videoRef.current
      if (!video) return

      void sampleFaceFromVideo(video, canvasRef.current!).then((sample) => {
        onSampleRef.current?.(sample)

        if (selfieMode) {
          if (sample.face) {
            faceHoldRef.current = Math.min(
              selfieProgressMs,
              faceHoldRef.current + dt,
            )
          } else {
            faceHoldRef.current = Math.max(0, faceHoldRef.current - dt * 1.5)
          }
          setHoldMs(faceHoldRef.current)
          if (
            faceHoldRef.current >= selfieProgressMs &&
            !completedRef.current &&
            videoRef.current
          ) {
            completedRef.current = true
            onSelfieRef.current?.(videoRef.current)
          }
        }
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, status, selfieMode, selfieProgressMs])

  if (!active) return null

  const progress = Math.min(1, holdMs / selfieProgressMs)

  return (
    <div
      className={`pointer-events-none ${
        selfieMode
          ? 'absolute left-1/2 top-[max(4.5rem,env(safe-area-inset-top))] z-40 w-[min(72vw,280px)] -translate-x-1/2'
          : 'absolute right-3 top-[max(4.5rem,env(safe-area-inset-top))] z-40 h-28 w-28'
      } ${className}`}
    >
      <div
        className={`relative overflow-hidden border border-ice/40 bg-black/50 shadow-lg backdrop-blur-sm ${
          selfieMode ? 'rounded-3xl' : 'rounded-2xl'
        }`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          data-front-video
          className={`w-full scale-x-[-1] object-cover ${
            selfieMode ? 'aspect-[3/4]' : 'h-28 w-28'
          } ${status === 'active' ? 'opacity-100' : 'opacity-0'}`}
        />
        {status !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[10px] text-fog">
            Ön kamera
          </div>
        )}
        {selfieMode && (
          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2">
            <p className="text-center text-[10px] uppercase tracking-wider text-ice">
              {progress >= 1 ? 'Selfie hazır' : 'Yüzünü tut · selfie'}
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-signal transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
