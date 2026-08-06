export interface BallState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export function createBall(): BallState {
  return { x: 0, y: 1.35, z: -2.1, vx: 0, vy: 0.5, vz: 0 }
}

export function stepBall(ball: BallState, dt: number, gravity: number): BallState {
  const n = { ...ball }
  n.vy -= gravity * dt
  n.x += n.vx * dt
  n.y += n.vy * dt
  n.z += n.vz * dt
  n.vx *= 0.995
  n.vz *= 0.995
  return n
}

export function isGrounded(ball: BallState): boolean {
  return ball.y <= 0.12
}

export function inKickZone(ball: BallState, forgive: number): boolean {
  const dist = Math.hypot(ball.x, ball.z + 2)
  return ball.y > 0.25 && ball.y < 2.9 && dist < 0.55 + forgive
}

export function apexQuality(ball: BallState): number {
  const speed = Math.abs(ball.vy)
  if (speed > 2.5) return 0
  return Math.max(0, 1 - speed / 2.5)
}

export function applyKick(
  ball: BallState,
  power: number,
  tiltX: number,
  powerBoost: number,
): BallState {
  const n = { ...ball }
  n.vy = 3.1 + power * 2.5 + powerBoost
  n.vx = tiltX * 1.5 + (Math.random() - 0.5) * 0.12
  n.vz = -0.3
  if (n.y < 0.4) n.y = 0.45
  return n
}

export function clampTilt(beta: number, gamma: number) {
  return {
    tiltX: Math.max(-1, Math.min(1, gamma / 35)),
    tiltY: Math.max(-1, Math.min(1, (beta - 45) / 40)),
  }
}

export function fmtX(m: number): string {
  if (Number.isInteger(m)) return `${m}x`
  return `${m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x`
}
