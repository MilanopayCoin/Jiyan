import { describe, expect, it } from 'vitest'
import {
  applyKick,
  apexQuality,
  createBall,
  inKickZone,
  isGrounded,
  stepBall,
} from './vrPhysics'
import { VR_MODES } from './modes'

describe('vr physics', () => {
  it('ball falls under gravity and grounds', () => {
    let ball = createBall()
    ball.vy = 0
    for (let i = 0; i < 120; i++) {
      ball = stepBall(ball, 0.016, 9.5)
    }
    expect(isGrounded(ball)).toBe(true)
  })

  it('kick lifts ball into zone then out', () => {
    let ball = createBall()
    ball = applyKick(ball, 0.8, 0, 0)
    expect(ball.vy).toBeGreaterThan(2)
    expect(inKickZone(ball, 0.5)).toBe(true)
  })

  it('apex quality peaks when vy near 0', () => {
    const ball = createBall()
    ball.vy = 0.1
    expect(apexQuality(ball)).toBeGreaterThan(0.8)
  })

  it('modes are defined', () => {
    expect(VR_MODES.hattrick.multStep).toBeGreaterThan(0)
    expect(VR_MODES.keepy.maxAirMs).toBeDefined()
  })
})
