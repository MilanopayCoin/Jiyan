import { CameraBackground } from './components/CameraBackground'
import { DroneScene } from './components/DroneScene'
import { BottomNav } from './components/BottomNav'
import { HomeScreen } from './components/screens/HomeScreen'
import { FlightScreen } from './components/screens/FlightScreen'
import { ResultScreen } from './components/screens/ResultScreen'
import { LeaderboardScreen } from './components/screens/LeaderboardScreen'
import { ProfileScreen } from './components/screens/ProfileScreen'
import { HangarScreen } from './components/screens/HangarScreen'
import { ModesScreen } from './components/screens/ModesScreen'
import { VrPlayScreen } from './components/screens/VrPlayScreen'
import { useGame } from './game/useGame'
import { useVrMode } from './game/useVrMode'

export default function App() {
  const game = useGame()
  const vr = useVrMode()
  const showCraft =
    game.screen === 'home' ||
    game.screen === 'flight' ||
    game.screen === 'result'
  const showCamera =
    game.screen !== 'modes' && game.screen !== 'vr-play'

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${
        game.shaking ? 'shake' : ''
      }`}
    >
      {showCamera && (
        <CameraBackground
          showHint={game.screen === 'home' || game.screen === 'flight'}
          onSkySample={game.setSkySample}
        />
      )}

      {!showCamera && game.screen === 'modes' && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 50% 100%, #0d3d2a 0%, #0a1628 50%, #03080e 100%)',
          }}
        />
      )}

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
          led={game.screen === 'home' ? 'safe' : game.led}
          craftId={game.profile.selectedCraft}
          skinId={game.profile.selectedSkin}
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
      {game.screen === 'modes' && <ModesScreen vr={vr} game={game} />}
      {game.screen === 'vr-play' && <VrPlayScreen vr={vr} game={game} />}

      <BottomNav screen={game.screen} onNavigate={game.setScreen} />
    </div>
  )
}
