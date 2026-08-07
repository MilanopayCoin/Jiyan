import type { ReactNode } from 'react'
import { PhantomProvider, darkTheme } from '@phantom/react-sdk'
import { AddressType } from '@phantom/browser-sdk'

const appId = (import.meta.env.VITE_PHANTOM_APP_ID as string | undefined)?.trim()
const redirectUrl =
  (import.meta.env.VITE_PHANTOM_REDIRECT_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? `${window.location.origin}/` : undefined)

/** Social login needs a Phantom Portal appId; injected extension works without it. */
const providers = appId
  ? (['injected', 'google', 'apple'] as const)
  : (['injected'] as const)

export function hasPhantomAppId(): boolean {
  return Boolean(appId)
}

export function PhantomRoot({ children }: { children: ReactNode }) {
  return (
    <PhantomProvider
      config={{
        providers: [...providers],
        ...(appId ? { appId } : {}),
        addressTypes: [AddressType.solana],
        ...(appId && redirectUrl
          ? { authOptions: { redirectUrl } }
          : {}),
      }}
      theme={darkTheme}
      appName="Zincir: Drone"
      appIcon="/favicon.svg"
    >
      {children}
    </PhantomProvider>
  )
}
