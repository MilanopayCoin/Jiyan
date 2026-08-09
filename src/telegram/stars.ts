/** Telegram Stars stakes (invoice when bot token configured). */

import { getWebApp, isTelegramMiniApp } from './webApp'

const API = (import.meta.env.VITE_SYNC_API as string | undefined) || '/api'

/** Stars charged per flight when paying with Stars */
export const STARS_FLIGHT_COST = 50
/** Welcome pack inside Telegram */
export const STARS_WELCOME = 100

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending'

export async function createStarsInvoice(
  stars: number,
  title = 'Zincir Stars',
  description = 'Uçuş için Stars bakiyesi',
): Promise<string | null> {
  try {
    const res = await fetch(`${API}/stars-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stars, title, description }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { invoiceUrl?: string }
    return data.invoiceUrl || null
  } catch {
    return null
  }
}

export function openStarsInvoice(
  invoiceUrl: string,
  onStatus?: (s: InvoiceStatus) => void,
): void {
  if (!isTelegramMiniApp()) {
    onStatus?.('failed')
    return
  }
  try {
    getWebApp().openInvoice(invoiceUrl, (status) => {
      onStatus?.(status as InvoiceStatus)
    })
  } catch {
    onStatus?.('failed')
  }
}

/** Buy Stars pack (default 100). Falls back to demo credit outside bot. */
export async function buyStarsPack(
  stars = STARS_WELCOME,
): Promise<'paid' | 'demo' | 'cancelled' | 'failed'> {
  const url = await createStarsInvoice(stars)
  if (!url) {
    // Demo / missing bot token
    return isTelegramMiniApp() ? 'demo' : 'demo'
  }
  return new Promise((resolve) => {
    openStarsInvoice(url, (s) => {
      if (s === 'paid') resolve('paid')
      else if (s === 'cancelled') resolve('cancelled')
      else resolve('failed')
    })
  })
}
