/** Premium / boost-gated $5 USDC table. */

import { getTgUser, getWebApp, isTelegramMiniApp } from './webApp'

export const BOOST_TABLE_USD = 5

/** Telegram Premium or opened via boost start_param / channel context. */
export function hasBoostAccess(forcedBoostParam = false): boolean {
  if (forcedBoostParam) return true
  const user = getTgUser()
  if (user?.is_premium) return true
  if (!isTelegramMiniApp()) {
    // Browser demo: allow when ?boost=1
    try {
      return new URL(location.href).searchParams.get('boost') === '1'
    } catch {
      return false
    }
  }
  try {
    const chat = getWebApp().initDataUnsafe?.chat as
      | { type?: string }
      | undefined
    // Channel / group opens can treat as community boost funnel
    if (chat?.type === 'channel') return true
  } catch {
    // ignore
  }
  return false
}

export function boostTableLabel(): string {
  return `Boost masa $${BOOST_TABLE_USD}`
}
