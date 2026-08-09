import { useEffect } from 'react'
import { BackButton, MainButton } from '@twa-dev/sdk/react'
import type { GameApi } from '../game/useGame'
import { isTelegramMiniApp } from '../telegram/webApp'
import { canStakeCrypto } from '../game/walletOps'
import { ASSETS } from '../game/assets'

interface Props {
  game: GameApi
}

/**
 * Native Telegram chrome: MainButton + BackButton.
 * No-ops visually outside Telegram (SDK still mounts safely).
 */
export function TelegramChrome({ game }: Props) {
  const inside = isTelegramMiniApp()

  useEffect(() => {
    if (!inside) return
    document.body.classList.add('tg-mini-app')
    return () => document.body.classList.remove('tg-mini-app')
  }, [inside])

  if (!inside) return null

  const { screen, phase, layer, profile } = game
  const stakeAmt =
    profile.stakeAmount ||
    (profile.highRoller ? ASSETS[profile.payAsset].flightStake : 1)
  const canFly =
    canStakeCrypto(profile, profile.payAsset, stakeAmt) ||
    profile.flightCredits > 0

  const showBack = screen !== 'home' && screen !== 'flight'

  let mainText = ''
  let mainVisible = false
  let mainHandler: (() => void) | null = null

  if (screen === 'home') {
    mainText = 'UÇUŞA BAŞLA'
    mainVisible = canFly
    mainHandler = () => {
      void game.startFlight()
    }
  } else if (screen === 'flight' && phase === 'climbing' && layer >= 1) {
    mainText = 'İNDİR'
    mainVisible = true
    mainHandler = () => game.cashOut()
  } else if (screen === 'result') {
    mainText = canFly ? 'TEKRAR UÇ' : 'ANA EKRAN'
    mainVisible = true
    mainHandler = () => {
      if (canFly) void game.startFlight()
      else game.goHome()
    }
  }

  return (
    <>
      {showBack && (
        <BackButton
          onClick={() => {
            if (screen === 'result') game.goHome()
            else game.setScreen('home')
          }}
        />
      )}
      {mainVisible && mainHandler && (
        <MainButton text={mainText} onClick={mainHandler} />
      )}
    </>
  )
}
