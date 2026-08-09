/** Selfie share card: front-camera frame + flight score overlay. */

import { fmtX } from '../game/math'
import type { FlightResult } from '../game/types'
import { CRAFTS } from '../game/vehicles'
import { formatUsd } from '../game/stableEconomy'

const W = 1080
const H = 1920

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export async function buildSelfieCard(
  result: FlightResult,
  video: HTMLVideoElement | null,
  pilotName: string,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const won = result.outcome === 'cashed'
  const craft = CRAFTS[result.craftId]

  // Mirrored selfie background
  let used = false
  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    try {
      ctx.save()
      ctx.translate(W, 0)
      ctx.scale(-1, 1)
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight)
      const dw = video.videoWidth * scale
      const dh = video.videoHeight * scale
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh)
      ctx.restore()
      used = true
    } catch {
      used = false
    }
  }
  if (!used) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#132a45')
    g.addColorStop(1, '#061018')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  const vig = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.15, W / 2, H / 2, H * 0.7)
  vig.addColorStop(0, 'transparent')
  vig.addColorStop(1, 'rgba(3,8,14,0.7)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(232,241,250,0.95)'
  ctx.font = '800 48px "Exo 2", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ZİNCİR: DRONE', W / 2, 150)

  ctx.fillStyle = '#7dd3fc'
  ctx.font = '600 34px Outfit, sans-serif'
  ctx.fillText(`${pilotName || 'Pilot'} · Selfie Pilot`, W / 2, 210)

  const panelY = H * 0.72
  ctx.fillStyle = 'rgba(6,16,24,0.8)'
  roundRect(ctx, 80, panelY, W - 160, 360, 36)
  ctx.fill()

  ctx.fillStyle = won ? '#3dffa8' : '#ff4d6a'
  ctx.font = '800 34px "Exo 2", sans-serif'
  ctx.fillText(won ? 'SELFIE İNİŞ' : 'SELFIE ANI', W / 2, panelY + 70)

  ctx.fillStyle = '#8ba3bd'
  ctx.font = '500 28px Outfit, sans-serif'
  ctx.fillText(craft.name, W / 2, panelY + 120)

  ctx.fillStyle = won ? '#3dffa8' : '#ff4d6a'
  ctx.font = '800 120px "Exo 2", sans-serif'
  ctx.fillText(won ? fmtX(result.multiplier) : '0x', W / 2, panelY + 250)

  if (result.usdcPayout != null) {
    ctx.fillStyle = '#7dd3fc'
    ctx.font = '600 28px Outfit, sans-serif'
    const sign = result.usdcPayout >= 0 ? '+' : '−'
    ctx.fillText(
      `${sign}${formatUsd(Math.abs(result.usdcPayout))} USDC`,
      W / 2,
      panelY + 310,
    )
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export async function shareSelfieCard(
  result: FlightResult,
  video: HTMLVideoElement | null,
  pilotName: string,
): Promise<'shared' | 'copied' | 'download' | 'cancelled'> {
  const text = `Zincir: Drone — Selfie Pilot! ${fmtX(result.multiplier)} · ${location.href}`
  const blob = await buildSelfieCard(result, video, pilotName)
  const file = blob
    ? new File([blob], 'zincir-drone-selfie.png', { type: 'image/png' })
    : null

  try {
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Zincir: Drone Selfie', text, files: [file] })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title: 'Zincir: Drone Selfie', text, url: location.href })
      return 'shared'
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'cancelled'
  }

  if (file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zincir-drone-selfie.png'
    a.click()
    URL.revokeObjectURL(url)
  }
  try {
    await navigator.clipboard.writeText(text)
    return file ? 'download' : 'copied'
  } catch {
    return file ? 'download' : 'copied'
  }
}
