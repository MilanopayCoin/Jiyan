import { useEffect, useRef, useState } from 'react'
import { requestRearCamera, stopStream, type CameraStatus } from '../utils/camera'

interface Props {
  className?: string
}

export function CameraBackground({ className = '' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CameraStatus>('pending')
  const streamRef = useRef<MediaStream | null>(null)

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
          // Autoplay may fail until gesture; still show frame once playing
        }
      }
    })()

    return () => {
      cancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

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
      {/* Soft cloud bands */}
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
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          status === 'active' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transform: 'scaleX(1)' }}
      />

      {/* Subtle vignette over camera */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(3,8,14,0.55) 100%)',
        }}
      />

      {showFallback && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] z-10 w-[90%] max-w-sm -translate-x-1/2 text-center">
          <p className="rounded-full bg-black/40 px-4 py-2 text-xs text-fog backdrop-blur-sm">
            Kamera kapalı — gökyüzü modu aktif. En iyi deneyim için kamerayı
            gökyüzüne çevir.
          </p>
        </div>
      )}
    </div>
  )
}
