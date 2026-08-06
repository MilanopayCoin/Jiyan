import { useEffect, useRef, useState } from 'react'
import { requestRearCamera, stopStream, type CameraStatus } from '../utils/camera'
import { sampleSkyScore, skyBonusFromScore } from '../utils/skyDetect'

interface Props {
  className?: string
  /** Show sky-fallback tip (home / flight only) */
  showHint?: boolean
  /** Report live sky analysis (~2 Hz) */
  onSkySample?: (sample: ReturnType<typeof skyBonusFromScore>) => void
}

export function CameraBackground({
  className = '',
  showHint = false,
  onSkySample,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<CameraStatus>('pending')
  const streamRef = useRef<MediaStream | null>(null)
  const onSkyRef = useRef(onSkySample)
  onSkyRef.current = onSkySample

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { status: s, stream } = await requestRearCamera()
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
          // Autoplay may fail until gesture
        }
      }
      if (s !== 'active') {
        onSkyRef.current?.(skyBonusFromScore(0))
      }
    })()

    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  // Sample sky score while camera is live
  useEffect(() => {
    if (status !== 'active') return

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }

    let raf = 0
    let last = 0
    let lastReported = -1

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 450) return
      last = t
      const video = videoRef.current
      if (!video) return
      const score = sampleSkyScore(video, canvasRef.current!)
      const sample = skyBonusFromScore(score)
      // Avoid noisy updates
      if (Math.abs(sample.score - lastReported) < 0.04 && lastReported >= 0) return
      lastReported = sample.score
      onSkyRef.current?.(sample)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [status])

  const showFallback = status === 'denied' || status === 'unavailable'

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Sky fallback */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 100%, #1a4a6e 0%, #0c2744 42%, #071018 78%, #03080e 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(125,211,252,0.25), transparent 40%), radial-gradient(circle at 80% 20%, rgba(61,255,168,0.12), transparent 35%), linear-gradient(180deg, transparent 55%, rgba(6,16,24,0.55) 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-[18%] h-24 opacity-30 blur-2xl"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
        }}
        aria-hidden
      />

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        data-share-video
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          status === 'active' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(3,8,14,0.55) 100%)',
        }}
      />

      {showHint && showFallback && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] z-10 w-[90%] max-w-sm -translate-x-1/2 text-center">
          <p className="rounded-full bg-black/40 px-4 py-2 text-xs text-fog backdrop-blur-sm">
            Kamera kapalı — gökyüzü bonusu için kamerayı aç ve gökyüzüne çevir.
          </p>
        </div>
      )}
    </div>
  )
}
