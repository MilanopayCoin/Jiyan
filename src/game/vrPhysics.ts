/** Lightweight 3D ball physics for VR arena modes */

export interface BallState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export function createBall(z = -2.2): BallState {
  return { x: 0, y: 1.4, z, vx: 0, vy: 0.6, vz: 0 }
}

export function stepBall(
  ball: BallState,
  dt: number,
  gravity: number,
): BallState {
  const next = { ...ball }
  next.vy -= gravity * dt
  next.x += next.vx * dt
  next.y += next.vy * dt
  next.z += next.vz * dt
  // Soft horizontal damp
  next.vx *= 0.995
  next.vz *= 0.995
  return next
}

export function isGrounded(ball: BallState, groundY = 0.12): boolean {
  return ball.y <= groundY
}

/** Kick zone: ball roughly in front of player view (local space approx) */
export function inKickZone(
  ball: BallState,
  forgive: number,
): boolean {
  const dist = Math.hypot(ball.x, ball.z + 2.0)
  const heightOk = ball.y > 0.25 && ball.y < 2.8
  return heightOk && dist < 0.55 + forgive
}

/** How close ball is to apex (0 = rising/falling hard, 1 = at peak) */
export function apexQuality(ball: BallState): number {
  const speed = Math.abs(ball.vy)
  if (speed > 2.5) return 0
  return Math.max(0, 1 - speed / 2.5)
}

export function applyKick(
  ball: BallState,
  power: number,
  lookX: number,
  lookY: number,
): BallState {
  const next = { ...ball }
  next.vy = 3.2 + power * 2.4 + lookY * 0.8
  next.vx = lookX * 1.6 + (Math.random() - 0.5) * 0.15
  next.vz = -0.35 + lookY * -0.2
  // Nudge up if near ground
  if (next.y < 0.4) next.y = 0.45
  return next
}

export function clampLook(beta: number, gamma: number): { lookX: number; lookY: number } {
  // beta: front-back tilt, gamma: left-right
  const lookX = Math.max(-1, Math.min(1, gamma / 35))
  const lookY = Math.max(-1, Math.min(1, (beta - 45) / 40))
  return { lookX, lookY }
}
