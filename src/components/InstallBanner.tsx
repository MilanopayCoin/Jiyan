import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Small install / PWA hint for Home */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setStandalone(isStandalone)
    try {
      if (sessionStorage.getItem('zincir-install-hide') === '1') setHidden(true)
    } catch {
      // ignore
    }

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  if (standalone || hidden || !deferred) return null

  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-ice/25 bg-ice/10 px-3 py-2.5 text-sm text-ice backdrop-blur-md">
      <p className="min-w-0 flex-1 text-xs leading-snug">
        Ana ekrana ekle — bildirimler ve tam ekran uçuş için
      </p>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-ice/25 px-3 py-1.5 text-xs font-semibold text-white"
        onClick={async () => {
          await deferred.prompt()
          await deferred.userChoice
          setDeferred(null)
        }}
      >
        Yükle
      </button>
      <button
        type="button"
        className="shrink-0 text-fog"
        aria-label="Kapat"
        onClick={() => {
          setHidden(true)
          try {
            sessionStorage.setItem('zincir-install-hide', '1')
          } catch {
            // ignore
          }
        }}
      >
        ✕
      </button>
    </div>
  )
}
