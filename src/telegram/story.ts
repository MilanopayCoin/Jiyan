/** Share landing card to Telegram Stories. */

import { buildResultCard } from '../utils/shareCard'
import type { FlightResult } from '../game/types'
import { fmtX } from '../game/math'
import { getWebApp, isTelegramMiniApp, telegramStartAppLink } from './webApp'
import { getOrCreatePilotId } from '../game/friends'

const API = (import.meta.env.VITE_SYNC_API as string | undefined) || '/api'

async function uploadStoryPng(blob: Blob): Promise<string | null> {
  try {
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    bytes.forEach((b) => {
      bin += String.fromCharCode(b)
    })
    const b64 = btoa(bin)
    const res = await fetch(`${API}/story-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ png: b64 }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string; url?: string }
    if (data.url) return data.url
    if (data.id) {
      const origin = location.origin
      return `${origin}${API}/story-media?id=${encodeURIComponent(data.id)}`
    }
    return null
  } catch {
    return null
  }
}

export async function shareResultToStory(
  result: FlightResult,
  pilotName: string,
): Promise<'shared' | 'unsupported' | 'failed'> {
  if (!isTelegramMiniApp()) return 'unsupported'
  const wa = getWebApp()
  if (typeof wa.shareToStory !== 'function' || !wa.isVersionAtLeast?.('7.8')) {
    return 'unsupported'
  }

  const blob = await buildResultCard(result)
  if (!blob) return 'failed'
  const mediaUrl = await uploadStoryPng(blob)
  if (!mediaUrl) return 'failed'

  const invite = telegramStartAppLink(getOrCreatePilotId())
  const text =
    result.outcome === 'cashed'
      ? `${pilotName} · Zincir: Drone ${fmtX(result.multiplier)} iniş`
      : `${pilotName} · Zincir: Drone düşüş · K${result.layer}`

  try {
    wa.shareToStory(mediaUrl, {
      text,
      widget_link: invite
        ? { url: invite, name: 'Kalkış' }
        : undefined,
    })
    return 'shared'
  } catch {
    return 'failed'
  }
}
