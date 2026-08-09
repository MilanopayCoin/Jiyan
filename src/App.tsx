import { CameraBackground } from './components/CameraBackground'
import { FrontFaceOverlay } from './components/FrontFaceOverlay'
import { DroneScene } from './components/DroneScene'
import { BottomNav } from './components/BottomNav'
import { HomeScreen } from './components/screens/HomeScreen'
import { FlightScreen } from './components/screens/FlightScreen'
import { ResultScreen } from './components/screens/ResultScreen'
import { LeaderboardScreen } from './components/screens/LeaderboardScreen'
import { ProfileScreen } from './components/screens/ProfileScreen'
import { HangarScreen } from './components/screens/HangarScreen'
import { WalletScreen } from './components/screens/WalletScreen'
import { useGame } from './game/useGame'
import { useTilt } from './utils/tilt'

function windClass(layer: number, windShake: boolean, shaking: boolean): string {
  if (shaking) return 'shake'
  if (windShake) return 'wind-gust'
  if (layer >= 6) return 'wind-heavy'
  if (layer >= 4) return 'wind-mid'
  if (layer >= 2) return 'wind-light'
  return ''
}

export default function App() {
  const game = useGame()
  const showCraft =
    game.screen === 'home' ||
    game.screen === 'flight' ||
    game.screen === 'result'

  const tiltEnabled =
    game.screen === 'flight' || game.screen === 'home' || game.screen === 'result'
  const tilt = useTilt(tiltEnabled)

  const inFlight = game.screen === 'flight' && game.phase === 'climbing'
  const layerForWind = inFlight ? game.layer : 0
  const wantFront =
    (game.screen === 'flight' && !game.challengeMode && !game.blindMode) ||
    (game.screen === 'result' && game.result?.outcome === 'cashed')
  const selfieMode =
    game.screen === 'result' &&
    game.result?.outcome === 'cashed' &&
    !game.result.selfieCaptured

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${windClass(
        layerForWind,
        game.windShake,
        game.shaking,
      )}`}
    >
      <CameraBackground
        enabled={!wantFront}
        showHint={game.screen === 'home'}
        onSkySample={game.setSkySample}
        blinded={
          game.screen === 'flight' && game.blindMode && game.layer >= 3
        }
      />

      <FrontFaceOverlay
        active={wantFront}
        selfieMode={selfieMode}
        onSample={game.setFaceSample}
        onSelfieComplete={() => {
          game.completeSelfie()
        }}
      />

      {showCraft && (
        <DroneScene
          layer={game.screen === 'home' ? 0 : game.layer}
          phase={
            game.screen === 'home'
              ? 'idle'
              : game.phase === 'done'
                ? game.result?.outcome === 'cashed'
                  ? 'landing'
                  : game.result?.outcome === 'crashed'
                    ? 'crashing'
                    : 'idle'
                : game.phase
          }
          led={
            game.screen === 'home'
              ? 'safe'
              : game.displayLed
          }
          craftId={game.profile.selectedCraft}
          skinId={game.profile.selectedSkin}
          tiltX={tilt.allowed ? tilt.x : 0}
          tiltY={tilt.allowed ? tilt.y : 0}
        />
      )}

      {game.flash && (
        <div
          className="flash-danger pointer-events-none absolute inset-0 z-50 bg-danger"
          aria-hidden
        />
      )}

      {game.shieldFlash && (
        <div
          className="flash-shield pointer-events-none absolute inset-0 z-50"
          aria-hidden
        />
      )}

      {game.screen === 'home' && <HomeScreen game={game} />}
      {game.screen === 'flight' && <FlightScreen game={game} />}
      {game.screen === 'result' && <ResultScreen game={game} />}
      {game.screen === 'leaderboard' && <LeaderboardScreen game={game} />}
      {game.screen === 'profile' && <ProfileScreen game={game} />}
      {game.screen === 'hangar' && <HangarScreen game={game} />}
      {game.screen === 'wallet' && <WalletScreen game={game} />}

      <BottomNav screen={game.screen} onNavigate={game.setScreen} />
    </div>
  )
}
