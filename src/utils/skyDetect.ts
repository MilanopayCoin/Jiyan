/** Sky detection from camera frames + multiplier bonus helpers */

export const SKY_BONUS_MIN = 0.1 // +10% at threshold
export const SKY_BONUS_MAX = 0.2 // +20% at full sky
export const SKY_SCORE_THRESHOLD = 0.38

export interface SkySample {
  score: number
  /** 0–1 bonus fraction (0 if below threshold) */
  bonus: number
  active: boolean
}

/** Map sky score → bonus fraction (0, or 0.10–0.20) */
export function skyBonusFromScore(score: number): SkySample {
  const s = Math.max(0, Math.min(1, score))
  if (s < SKY_SCORE_THRESHOLD) {
    return { score: s, bonus: 0, active: false }
  }
  const t = (s - SKY_SCORE_THRESHOLD) / (1 - SKY_SCORE_THRESHOLD)
  const bonus = SKY_BONUS_MIN + t * (SKY_BONUS_MAX - SKY_BONUS_MIN)
  return { score: s, bonus: Number(bonus.toFixed(3)), active: true }
}

export function applySkyBonus(baseMultiplier: number, bonus: number): number {
  if (bonus <= 0) return baseMultiplier
  return Number((baseMultiplier * (1 + bonus)).toFixed(2))
}

export function formatSkyBonus(bonus: number): string {
  if (bonus <= 0) return ''
  return `+${Math.round(bonus * 100)}%`
}

/**
 * Analyze upper portion of a video frame for open-sky likeness.
 * Uses tiny offscreen canvas — cheap enough for ~2 Hz sampling.
 */
export function sampleSkyScore(
  video: HTMLVideoElement,
  canvas?: HTMLCanvasElement,
): number {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
    return 0
  }

  const w = 64
  const h = 48
  const c = canvas ?? document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0

  try {
    ctx.drawImage(video, 0, 0, w, h)
  } catch {
    return 0
  }

  const { data } = ctx.getImageData(0, 0, w, h)
  // Focus on upper 55% of frame (horizon / sky)
  const rowEnd = Math.floor(h * 0.55)
  let skyish = 0
  let total = 0
  let brightnessSum = 0

  for (let y = 0; y < rowEnd; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const brightness = (r + g + b) / 3
      brightnessSum += brightness
      total += 1

      const blueLead = b - Math.max(r, g)
      const cool = b >= r - 8 && b >= g - 12
      const brightOpen = brightness > 155
      const blueSky = blueLead > 18 && brightness > 90
      const paleSky = cool && brightness > 130 && Math.abs(r - g) < 35

      if (brightOpen || blueSky || paleSky) skyish += 1
    }
  }

  if (total === 0) return 0
  const ratio = skyish / total
  const avgBright = brightnessSum / total
  // Slight boost for uniformly bright upper frames (overcast sky)
  const uniformBoost = avgBright > 170 ? 0.08 : 0
  return Math.max(0, Math.min(1, ratio + uniformBoost))
}
