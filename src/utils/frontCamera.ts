import type { CameraStatus } from './camera'
import { stopStream } from './camera'

export async function requestFrontCamera(): Promise<{
  status: CameraStatus
  stream: MediaStream | null
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { status: 'unavailable', stream: null }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 720 },
        height: { ideal: 720 },
      },
    })
    return { status: 'active', stream }
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      })
      return { status: 'active', stream }
    } catch {
      return { status: 'denied', stream: null }
    }
  }
}

export { stopStream }
