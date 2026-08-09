import { useEffect, useMemo, useState } from 'react'
import {
  bootstrapTelegram,
  getStartParam,
  getTgUser,
  isTelegramMiniApp,
  tgDisplayName,
  type TgUser,
} from './webApp'

export function useTelegramBootstrap() {
  const [ready, setReady] = useState(false)
  const [inside, setInside] = useState(false)

  useEffect(() => {
    const ok = bootstrapTelegram()
    setInside(ok)
    setReady(true)
  }, [])

  const user = useMemo(() => (inside ? getTgUser() : null), [inside])
  const startParam = useMemo(() => (inside ? getStartParam() : null), [inside])

  return {
    ready,
    insideTg: inside,
    user,
    startParam,
    displayName: user ? tgDisplayName(user) : null,
  }
}

export function useTgUser(): TgUser | null {
  const [user, setUser] = useState<TgUser | null>(null)
  useEffect(() => {
    if (isTelegramMiniApp()) setUser(getTgUser())
  }, [])
  return user
}
