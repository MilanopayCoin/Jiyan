/**
 * Generate a shareable result card (camera frame + craft silhouette + score).
 */

import { fmtX } from '../game/math'
import type { CraftId, CraftSkinId, FlightResult } from '../game/types'
import { CRAFTS, SKINS } from '../game/vehicles'

const W = 1080
const H = 1920

function hexFromThree(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

function findVideo(): HTMLVideoElement | null {
  return (
    document.querySelector<HTMLVideoElement>('video[data-share-video]') ||
    document.querySelector('video')
  )
}

function findCraftCanvas(): HTMLCanvasElement | null {
  return (
    document.querySelector<HTMLCanvasElement>('[data-share-gl]') ||
    document.querySelector<HTMLCanvasElement>('[data-drone-canvas] canvas')
  )
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
): void {
  const scale = Math.max(W / sw, H / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = (W - dw) / 2
  const dy = (H - dh) / 2
  ctx.drawImage(source, dx, dy, dw, dh)
}

function drawSkyFallback(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(W * 0.5, H, W * 0.2, W * 0.5, H * 0.35, H)
  g.addColorStop(0, '#1a4a6e')
  g.addColorStop(0.4, '#0c2744')
  g.addColorStop(0.75, '#071018')
  g.addColorStop(1, '#03080e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const haze = ctx.createRadialGradient(
    W * 0.2,
    H * 0.25,
    0,
    W * 0.2,
    H * 0.25,
    W * 0.5,
  )
  haze.addColorStop(0, 'rgba(125,211,252,0.28)')
  haze.addColorStop(1, 'transparent')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, W, H)
}

function drawCraftSilhouette(
  ctx: CanvasRenderingContext2D,
  craftId: CraftId,
  skinId: CraftSkinId,
  cx: number,
  cy: number,
  scale: number,
): void {
  const skin = SKINS[skinId]
  const body = hexFromThree(skin.bodyColor)
  const accent = hexFromThree(skin.accentColor)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 12

  if (craftId === 'plane') {
    ctx.fillStyle = body
    roundRect(ctx, -90, -18, 180, 36, 18)
    ctx.fill()
    ctx.fillStyle = accent
    roundRect(ctx, -70, -8, 140, 16, 4)
    ctx.fill()
    ctx.fillStyle = accent
    roundRect(ctx, -20, -55, 80, 14, 4)
    ctx.fill()
    roundRect(ctx, -20, 40, 80, 14, 4)
    ctx.fill()
  } else if (craftId === 'rocket') {
    ctx.fillStyle = body
    roundRect(ctx, -28, -90, 56, 140, 22)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, -120)
    ctx.lineTo(28, -90)
    ctx.lineTo(-28, -90)
    ctx.closePath()
    ctx.fillStyle = accent
    ctx.fill()
    ctx.fillStyle = '#ff6b35'
    ctx.beginPath()
    ctx.moveTo(-16, 50)
    ctx.lineTo(0, 95)
    ctx.lineTo(16, 50)
    ctx.closePath()
    ctx.fill()
  } else if (craftId === 'balloon') {
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, -30, 70, 85, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ;[
      [40, 40],
      [40, -40],
      [-40, 40],
      [-40, -40],
    ].forEach(([x]) => {
      ctx.beginPath()
      ctx.moveTo(x * 0.55, 40)
      ctx.lineTo(x * 0.25, 95)
      ctx.stroke()
    })
    ctx.fillStyle = accent
    roundRect(ctx, -28, 90, 56, 36, 6)
    ctx.fill()
  } else {
    // drone
    ctx.fillStyle = body
    roundRect(ctx, -45, -18, 90, 36, 10)
    ctx.fill()
    const arms: [number, number][] = [
      [55, 55],
      [55, -55],
      [-55, 55],
      [-55, -55],
    ]
    arms.forEach(([x, z]) => {
      ctx.strokeStyle = accent
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(x, z)
      ctx.stroke()
      ctx.fillStyle = '#c8d6e5'
      ctx.beginPath()
      ctx.ellipse(x, z, 32, 8, Math.atan2(z, x), 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3dffa8'
      ctx.beginPath()
      ctx.arc(x * 0.65, z * 0.65, 6, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  ctx.restore()
}

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

export async function buildResultCard(
  result: FlightResult,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const won = result.outcome === 'cashed'
  const craft = CRAFTS[result.craftId]
  const skin = SKINS[result.skinId]

  // Background: live camera if available
  const video = findVideo()
  let usedVideo = false
  if (video && video.readyState >= 2 && video.videoWidth > 0) {
    try {
      drawCover(ctx, video, video.videoWidth, video.videoHeight)
      usedVideo = true
    } catch {
      // tainted / unavailable
    }
  }
  if (!usedVideo) drawSkyFallback(ctx)

  // Soft vignette
  const vig = ctx.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.2,
    W / 2,
    H / 2,
    H * 0.7,
  )
  vig.addColorStop(0, 'transparent')
  vig.addColorStop(1, 'rgba(3,8,14,0.72)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  // Try to overlay Three.js craft canvas if present
  const craftCanvas = findCraftCanvas()
  let drewThree = false
  if (craftCanvas && craftCanvas.width > 0) {
    try {
      ctx.globalAlpha = 0.95
      drawCover(ctx, craftCanvas, craftCanvas.width, craftCanvas.height)
      ctx.globalAlpha = 1
      drewThree = true
    } catch {
      // ignore
    }
  }
  if (!drewThree) {
    drawCraftSilhouette(
      ctx,
      result.craftId,
      result.skinId,
      W / 2,
      H * 0.42,
      won ? 2.2 : 1.8,
    )
  }

  // Brand
  ctx.fillStyle = 'rgba(232,241,250,0.92)'
  ctx.font = '800 52px "Exo 2", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ZİNCİR: DRONE', W / 2, 160)

  // Outcome panel
  const panelY = H * 0.68
  ctx.fillStyle = 'rgba(6,16,24,0.78)'
  roundRect(ctx, 80, panelY, W - 160, 420, 40)
  ctx.fill()

  ctx.fillStyle = won ? '#3dffa8' : '#ff4d6a'
  ctx.font = '800 36px "Exo 2", sans-serif'
  ctx.fillText(won ? 'GÜVENLİ İNİŞ' : 'SİNYAL KESİLDİ', W / 2, panelY + 70)

  ctx.fillStyle = '#8ba3bd'
  ctx.font = '500 28px Outfit, sans-serif'
  const craftLabel =
    skin.rarity !== 'common' ? `${craft.name} · ${skin.name}` : craft.name
  ctx.fillText(craftLabel, W / 2, panelY + 120)

  ctx.fillStyle = won ? '#3dffa8' : '#ff4d6a'
  ctx.font = '800 140px "Exo 2", sans-serif'
  ctx.fillText(won ? fmtX(result.multiplier) : '0x', W / 2, panelY + 260)

  ctx.fillStyle = '#8ba3bd'
  ctx.font = '500 30px Outfit, sans-serif'
  ctx.fillText(
    won
      ? `Katman ${result.layer} · kilitlendi`
      : `${fmtX(result.nearMissMultiplier)}'e az kaldı · K${result.layer}`,
    W / 2,
    panelY + 330,
  )

  if (result.skyBonus && result.skyBonus > 0) {
    ctx.fillStyle = '#7dd3fc'
    ctx.font = '600 26px Outfit, sans-serif'
    ctx.fillText(
      `Gökyüzü +${Math.round(result.skyBonus * 100)}%`,
      W / 2,
      panelY + 380,
    )
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export async function shareResultCard(result: FlightResult): Promise<'shared' | 'copied' | 'download' | 'cancelled'> {
  const craft = CRAFTS[result.craftId]
  const skin = SKINS[result.skinId]
  const rare = skin.rarity !== 'common'
  const craftBit = rare ? `${craft.name} (${skin.name})` : craft.name
  const sky =
    result.skyBonus && result.skyBonus > 0
      ? ` gökyüzü +${Math.round(result.skyBonus * 100)}%`
      : ''
  const won = result.outcome === 'cashed'
  const text = won
    ? `Zincir: Drone — ${craftBit} ile ${fmtX(result.multiplier)} indirdim!${sky}`
    : `Zincir: Drone — ${craftBit} ile ${fmtX(result.nearMissMultiplier)}'e az kaldı!${sky}`

  const blob = await buildResultCard(result)
  const file = blob
    ? new File([blob], 'zincir-drone.png', { type: 'image/png' })
    : null

  try {
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Zincir: Drone',
        text,
        files: [file],
      })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title: 'Zincir: Drone', text, url: location.href })
      return 'shared'
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'cancelled'
  }

  // Fallback: download image + copy text
  if (file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zincir-drone.png'
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
