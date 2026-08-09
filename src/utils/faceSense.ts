/** Lightweight front-camera face / gaze / smile cues (no ML deps). */

export interface FaceSample {
  face: boolean
  gaze: boolean
  smile: boolean
  /** 0–1 centeredness of face */
  gazeScore: number
  /** 0–1 smile heuristic */
  smileScore: number
  /** Face box relative to frame 0–1 */
  box: { x: number; y: number; w: number; h: number } | null
}

export const EMPTY_FACE: FaceSample = {
  face: false,
  gaze: false,
  smile: false,
  gazeScore: 0,
  smileScore: 0,
  box: null,
}

type DetectedBox = { x: number; y: number; width: number; height: number }

function skinLikely(r: number, g: number, b: number): boolean {
  // Loose YCbCr-ish skin gate for varied lighting
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return (
    y > 40 &&
    y < 240 &&
    cb > 77 &&
    cb < 140 &&
    cr > 125 &&
    cr < 180 &&
    r > 60 &&
    g > 30 &&
    r >= g
  )
}

/** Heuristic face box from skin-tone density (fallback without FaceDetector). */
export function findSkinFaceBox(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): DetectedBox | null {
  const cell = 4
  const gw = Math.ceil(w / cell)
  const gh = Math.ceil(h / cell)
  const grid = new Uint8Array(gw * gh)
  let hits = 0

  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const i = (y * w + x) * 4
      if (skinLikely(data[i], data[i + 1], data[i + 2])) {
        grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = 1
        hits += 1
      }
    }
  }
  if (hits < 18) return null

  let minX = gw
  let minY = gh
  let maxX = 0
  let maxY = 0
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (!grid[gy * gw + gx]) continue
      // Prefer upper-mid frame (selfie face zone)
      if (gy > gh * 0.85) continue
      minX = Math.min(minX, gx)
      minY = Math.min(minY, gy)
      maxX = Math.max(maxX, gx)
      maxY = Math.max(maxY, gy)
    }
  }
  if (maxX <= minX || maxY <= minY) return null

  const box = {
    x: minX * cell,
    y: minY * cell,
    width: (maxX - minX + 1) * cell,
    height: (maxY - minY + 1) * cell,
  }
  const area = (box.width * box.height) / (w * h)
  if (area < 0.04 || area > 0.85) return null
  const aspect = box.width / Math.max(1, box.height)
  if (aspect < 0.45 || aspect > 1.8) return null
  return box
}

export function gazeFromBox(
  box: DetectedBox,
  frameW: number,
  frameH: number,
): { gaze: boolean; gazeScore: number } {
  const cx = (box.x + box.width / 2) / frameW
  const cy = (box.y + box.height / 2) / frameH
  const dx = Math.abs(cx - 0.5)
  const dy = Math.abs(cy - 0.42)
  const size = (box.width * box.height) / (frameW * frameH)
  const centerScore = Math.max(0, 1 - dx * 3.2 - dy * 2.4)
  const sizeScore = Math.min(1, Math.max(0, (size - 0.05) / 0.25))
  const gazeScore = Number((centerScore * 0.65 + sizeScore * 0.35).toFixed(3))
  return { gaze: gazeScore >= 0.55, gazeScore }
}

/** Mouth-region brightness / width cue as smile proxy. */
export function smileFromBox(
  data: Uint8ClampedArray,
  frameW: number,
  box: DetectedBox,
): { smile: boolean; smileScore: number } {
  const x0 = Math.max(0, Math.floor(box.x + box.width * 0.18))
  const x1 = Math.min(frameW, Math.floor(box.x + box.width * 0.82))
  const mouthY0 = Math.floor(box.y + box.height * 0.58)
  const mouthY1 = Math.floor(box.y + box.height * 0.92)
  const cheekY0 = Math.floor(box.y + box.height * 0.28)
  const cheekY1 = Math.floor(box.y + box.height * 0.48)
  if (x1 <= x0 || mouthY1 <= mouthY0) {
    return { smile: false, smileScore: 0 }
  }

  const sampleBand = (y0: number, y1: number) => {
    let sum = 0
    let sum2 = 0
    let n = 0
    let bright = 0
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * frameW + x) * 4
        const v = (data[i] + data[i + 1] + data[i + 2]) / 3
        sum += v
        sum2 += v * v
        n += 1
        if (v > 150) bright += 1
      }
    }
    if (n === 0) return { mean: 0, std: 0, brightRatio: 0 }
    const mean = sum / n
    const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
    return { mean, std, brightRatio: bright / n }
  }

  const mouth = sampleBand(mouthY0, mouthY1)
  const cheek = sampleBand(cheekY0, cheekY1)
  // Smiles often raise mouth brightness variance + widen bright lower band
  const contrast = Math.max(0, mouth.std - cheek.std * 0.55)
  const lift = Math.max(0, mouth.brightRatio - cheek.brightRatio)
  const smileScore = Number(
    Math.min(1, contrast / 28 + lift * 1.4 + mouth.brightRatio * 0.25).toFixed(3),
  )
  return { smile: smileScore >= 0.42, smileScore }
}

export function sampleFromImageData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  box: DetectedBox | null,
): FaceSample {
  const faceBox = box ?? findSkinFaceBox(data, w, h)
  if (!faceBox) return EMPTY_FACE
  const { gaze, gazeScore } = gazeFromBox(faceBox, w, h)
  const { smile, smileScore } = smileFromBox(data, w, faceBox)
  return {
    face: true,
    gaze,
    smile,
    gazeScore,
    smileScore,
    box: {
      x: faceBox.x / w,
      y: faceBox.y / h,
      w: faceBox.width / w,
      h: faceBox.height / h,
    },
  }
}

declare global {
  interface Window {
    FaceDetector?: new (opts?: {
      fastMode?: boolean
      maxDetectedFaces?: number
    }) => {
      detect: (source: ImageBitmapSource) => Promise<
        Array<{
          boundingBox: { x: number; y: number; width: number; height: number }
        }>
      >
    }
  }
}

let detector: InstanceType<NonNullable<typeof window.FaceDetector>> | null | undefined

function getDetector() {
  if (detector !== undefined) return detector
  try {
    if (typeof window !== 'undefined' && window.FaceDetector) {
      detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
    } else {
      detector = null
    }
  } catch {
    detector = null
  }
  return detector
}

export async function sampleFaceFromVideo(
  video: HTMLVideoElement,
  canvas?: HTMLCanvasElement,
): Promise<FaceSample> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return EMPTY_FACE
  }
  const w = 160
  const h = 120
  const c = canvas ?? document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return EMPTY_FACE
  try {
    // Mirror like a selfie view for more natural face placement
    ctx.save()
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, w, h)
    ctx.restore()
  } catch {
    return EMPTY_FACE
  }

  let box: DetectedBox | null = null
  const det = getDetector()
  if (det) {
    try {
      const faces = await det.detect(c)
      const f = faces[0]
      if (f?.boundingBox) {
        box = {
          x: f.boundingBox.x,
          y: f.boundingBox.y,
          width: f.boundingBox.width,
          height: f.boundingBox.height,
        }
      }
    } catch {
      box = null
    }
  }

  const { data } = ctx.getImageData(0, 0, w, h)
  return sampleFromImageData(data, w, h, box)
}

/** Hold timers for UI / game gates */
export const GAZE_LOST_MS = 280
export const SMILE_HOLD_MS = 380
export const SELFIE_HOLD_MS = 2000
