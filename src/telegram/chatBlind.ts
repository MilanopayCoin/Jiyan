/** Group/chat shared blind flight seed. */

import { todayKey } from '../game/math'
import { getWebApp, isTelegramMiniApp, telegramBotUsername } from './webApp'
import { makeChatBlindStartParam } from './startParams'

function hashToken(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36).slice(0, 8)
}

export function chatContextId(): string | null {
  if (!isTelegramMiniApp()) {
    try {
      const q = new URL(location.href).searchParams.get('chat')
      return q && q.length >= 4 ? q.slice(0, 24) : null
    } catch {
      return null
    }
  }
  try {
    const chat = getWebApp().initDataUnsafe?.chat as { id?: number } | undefined
    if (chat?.id != null) return `c${chat.id}`
    const user = getWebApp().initDataUnsafe?.user as { id?: number } | undefined
    // DM fallback: personal daily blind room
    if (user?.id != null) return `u${user.id}`
  } catch {
    // ignore
  }
  return null
}

export function chatBlindToken(chatId?: string | null): string {
  const id = chatId || chatContextId() || 'global'
  return hashToken(`${id}:${todayKey()}`)
}

export function chatBlindSeed(token: string, craftId: string): string {
  return `zincir-chat-blind-${token}-${todayKey()}-${craftId}`
}

export function chatBlindInviteUrl(token?: string): string | null {
  const t = token || chatBlindToken()
  const bot = telegramBotUsername()
  if (!bot) {
    const origin =
      typeof location !== 'undefined'
        ? location.origin + location.pathname
        : 'https://chaindrone.netlify.app/'
    const base = origin.endsWith('/') ? origin : `${origin}/`
    return `${base}?cb=${encodeURIComponent(t)}`
  }
  return `https://t.me/${bot}?startapp=${makeChatBlindStartParam(t)}`
}

export function isGroupChatOpen(): boolean {
  if (!isTelegramMiniApp()) return false
  try {
    const chat = getWebApp().initDataUnsafe?.chat as
      | { type?: string }
      | undefined
    return chat?.type === 'group' || chat?.type === 'supergroup'
  } catch {
    return false
  }
}
