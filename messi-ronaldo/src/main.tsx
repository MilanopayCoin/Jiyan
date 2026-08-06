import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppShell } from './App'
import { useJuggle } from './game/useJuggle'

function Root() {
  const game = useJuggle()
  return <AppShell game={game} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
