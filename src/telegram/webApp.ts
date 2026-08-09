/** Telegram Mini App SDK helpers (safe outside Telegram). */

import WebApp from '@twa-dev/sdk'

export type TgUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export function getWebApp() {
  return WebApp
}

/** True when launched inside Telegram with init data. */
export function isTelegramMiniApp(): boolean {
  try {
    return Boolean(WebApp.initData && WebApp.initData.length > 0)
  } catch {
    return false
  }
}

export function getTgUser(): TgUser | null {
  try {
    const u = WebApp.initDataUnsafe?.user
    if (!u?.id || !u.first_name) return null
    return u as TgUser
  } catch {
    return null
  }
}

export function getStartParam(): string | null {
  try {
    const p = WebApp.initDataUnsafe?.start_param
    return typeof p === 'string' && p.length > 0 ? p : null
  } catch {
    return null
  }
}

export function tgDisplayName(user: TgUser): string {
  const raw = user.username || user.first_name || 'Pilot'
  return raw.replace(/[^\w\u00C0-\u024F\- ]/g, '').slice(0, 16) || 'Pilot'
}

export function applyTelegramTheme(): void {
  try {
    const p = WebApp.themeParams
    const root = document.documentElement
    if (p.bg_color) root.style.setProperty('--tg-bg', p.bg_color)
    if (p.text_color) root.style.setProperty('--tg-text', p.text_color)
    if (p.button_color) root.style.setProperty('--tg-button', p.button_color)
    if (p.button_text_color)
      root.style.setProperty('--tg-button-text', p.button_text_color)
    if (p.hint_color) root.style.setProperty('--tg-hint', p.hint_color)
    if (p.secondary_bg_color)
      root.style.setProperty('--tg-secondary', p.secondary_bg_color)
    WebApp.setHeaderColor(p.bg_color || '#0a1628')
    WebApp.setBackgroundColor(p.bg_color || '#0a1628')
  } catch {
    // ignore
  }
}

export function bootstrapTelegram(): boolean {
  try {
    WebApp.ready()
    WebApp.expand()
    try {
      // Bot API 7.7+
      ;(WebApp as unknown as { disableVerticalSwipes?: () => void }).disableVerticalSwipes?.()
    } catch {
      // older clients
    }
    applyTelegramTheme()
    document.documentElement.dataset.telegram = isTelegramMiniApp()
      ? '1'
      : '0'
    return isTelegramMiniApp()
  } catch {
    return false
  }
}

export function tgHaptic(
  kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light',
): void {
  if (!isTelegramMiniApp()) return
  try {
    const h = WebApp.HapticFeedback
    if (kind === 'success' || kind === 'error' || kind === 'warning') {
      h.notificationOccurred(kind)
    } else {
      h.impactOccurred(kind)
    }
  } catch {
    // ignore
  }
}

export function tgShareUrl(url: string, text?: string): void {
  try {
    if (typeof WebApp.openTelegramLink === 'function' && isTelegramMiniApp()) {
      const share = `https://t.me/share/url?url=${encodeURIComponent(url)}${
        text ? `&text=${encodeURIComponent(text)}` : ''
      }`
      WebApp.openTelegramLink(share)
      return
    }
  } catch {
    // fall through
  }
  void navigator.clipboard?.writeText(text ? `${text}\n${url}` : url)
}

export function telegramBotUsername(): string {
  return (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(
    /^@/,
    '',
  ) || ''
}

/** Deep link: https://t.me/bot?startapp=ref_PILOTID */
export function telegramStartAppLink(pilotId: string): string | null {
  const bot = telegramBotUsername()
  if (!bot || !pilotId) return null
  const param = `ref_${pilotId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 58)}`
  return `https://t.me/${bot}?startapp=${param}`
}

export function parseRefStartParam(param: string | null): string | null {
  if (!param) return null
  const m = param.match(/^ref_([A-Za-z0-9_-]{4,64})$/)
  return m?.[1] ?? null
}

export function tgSwitchInlineQuery(query: string): void {
  if (!isTelegramMiniApp()) return
  try {
    WebApp.switchInlineQuery(query, ['users', 'groups'])
  } catch {
    // ignore
  }
}

export function tgShareToStory(
  mediaUrl: string,
  params?: { text?: string; widget_link?: { url: string; name?: string } },
): boolean {
  if (!isTelegramMiniApp()) return false
  try {
    if (!WebApp.isVersionAtLeast('7.8')) return false
    WebApp.shareToStory(mediaUrl, params)
    return true
  } catch {
    return false
  }
}

export function isTgPremium(): boolean {
  return Boolean(getTgUser()?.is_premium)
}
