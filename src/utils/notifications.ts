/** Local notification helpers + SW messaging (no push server). */

export type NotifPermission = NotificationPermission | 'unsupported'

const PREF_KEY = 'zincir-drone-notif-pref'

export function getNotifPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function setNotifPref(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

export function notifPermission(): NotifPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') {
    setNotifPref(true)
    return 'granted'
  }
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  if (result === 'granted') setNotifPref(true)
  return result
}

async function showViaSW(title: string, body: string, tag: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body,
      tag,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: '/' },
    })
    return true
  } catch {
    return false
  }
}

export async function notify(
  title: string,
  body: string,
  tag = 'zincir',
): Promise<boolean> {
  if (!getNotifPref()) return false
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  const viaSw = await showViaSW(title, body, tag)
  if (viaSw) return true

  try {
    new Notification(title, { body, tag, icon: '/favicon.svg' })
    return true
  } catch {
    return false
  }
}

/** Streak-at-risk evening nudge when opening the app. */
export async function maybeStreakReminder(opts: {
  streak: number
  lastFlightDate: string | null
  today: string
}): Promise<void> {
  if (!getNotifPref() || opts.streak < 1) return
  if (opts.lastFlightDate === opts.today) return
  const hour = new Date().getHours()
  if (hour < 16) return

  const dayKey = `zincir-streak-nudge-${opts.today}`
  try {
    if (sessionStorage.getItem(dayKey)) return
    sessionStorage.setItem(dayKey, '1')
  } catch {
    // ignore
  }

  await notify(
    'Zincir: Drone',
    `Filon tehlikede! ${opts.streak} günlük serini korumak için bugün uç.`,
    'streak-risk',
  )
}

export async function notifyMissionComplete(label: string): Promise<void> {
  await notify('Görev tamam!', label, `mission-${label}`)
}

export async function notifySafeLanding(mult: string): Promise<void> {
  await notify('Güvenli iniş', `${mult} kilitlendi`, 'landing')
}
