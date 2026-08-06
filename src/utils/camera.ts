export type CameraStatus = 'pending' | 'active' | 'denied' | 'unavailable'

export async function requestRearCamera(): Promise<{
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
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    return { status: 'active', stream }
  } catch {
    // Retry without facingMode constraints (desktop / weird devices)
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

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}
