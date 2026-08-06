import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { FlightPhase, LedLevel } from '../game/types'

interface Props {
  layer: number
  phase: FlightPhase
  led: LedLevel
  className?: string
}

const LED_COLORS: Record<LedLevel, number> = {
  safe: 0x3dffa8,
  caution: 0xffb84d,
  critical: 0xff4d6a,
}

function createDrone(): {
  group: THREE.Group
  props: THREE.Mesh[]
  leds: THREE.Mesh[]
} {
  const group = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a2332,
    metalness: 0.7,
    roughness: 0.35,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    metalness: 0.5,
    roughness: 0.4,
  })

  // Central body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55), bodyMat)
  group.add(body)

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x0a1628,
      metalness: 0.2,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    }),
  )
  dome.position.y = 0.08
  group.add(dome)

  // Arms + motors + props
  const armPositions: [number, number][] = [
    [0.42, 0.42],
    [0.42, -0.42],
    [-0.42, 0.42],
    [-0.42, -0.42],
  ]
  const props: THREE.Mesh[] = []
  const leds: THREE.Mesh[] = []

  armPositions.forEach(([x, z], i) => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.05, 0.55),
      accentMat,
    )
    arm.position.set(x * 0.55, 0, z * 0.55)
    arm.rotation.y = Math.atan2(z, x)
    group.add(arm)

    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12),
      bodyMat,
    )
    motor.position.set(x, 0.06, z)
    group.add(motor)

    const prop = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.02, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0xc8d6e5,
        metalness: 0.3,
        roughness: 0.5,
        transparent: true,
        opacity: 0.85,
      }),
    )
    prop.position.set(x, 0.12, z)
    prop.userData.spinDir = i % 2 === 0 ? 1 : -1
    group.add(prop)
    props.push(prop)

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      new THREE.MeshStandardMaterial({
        color: LED_COLORS.safe,
        emissive: LED_COLORS.safe,
        emissiveIntensity: 1.4,
      }),
    )
    led.position.set(x * 0.7, -0.02, z * 0.7)
    group.add(led)
    leds.push(led)
  })

  // Landing skids
  ;[-0.22, 0.22].forEach((z) => {
    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.03, 0.04),
      accentMat,
    )
    skid.position.set(0, -0.14, z)
    group.add(skid)
  })

  return { group, props, leds }
}

export function DroneScene({ layer, phase, led, className = '' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ layer, phase, led })
  stateRef.current = { layer, phase, led }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      100,
    )
    camera.position.set(0, 1.1, 4.2)
    camera.lookAt(0, 0.2, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x1a2332, 1.1)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(2, 4, 3)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x3dffa8, 0.35)
    rim.position.set(-2, 1, -2)
    scene.add(rim)

    const { group: drone, props, leds } = createDrone()
    drone.position.set(0, 0.15, 0)
    scene.add(drone)

    // Soft ground shadow disc (reads as "landed on surface")
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 32),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.2
    scene.add(shadow)

    let targetScale = 1
    let currentScale = 1
    let targetY = 0.15
    let currentY = 0.15
    let crashT = 0
    let landT = 0
    let bobPhase = 0
    let windAmp = 0
    let disposed = false
    let raf = 0

    const applyLed = (level: LedLevel) => {
      const c = LED_COLORS[level]
      leds.forEach((ledMesh) => {
        const mat = ledMesh.material as THREE.MeshStandardMaterial
        mat.color.setHex(c)
        mat.emissive.setHex(c)
        mat.emissiveIntensity = level === 'critical' ? 2.2 : 1.4
      })
    }

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = Math.max(mount.clientHeight, 1)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const tick = () => {
      if (disposed) return
      raf = requestAnimationFrame(tick)
      const { layer: L, phase: P, led: ledLevel } = stateRef.current

      applyLed(ledLevel)

      // Prop spin — faster when climbing
      const spinSpeed = P === 'crashing' ? 0.08 : P === 'landing' ? 0.15 : 0.45
      props.forEach((p) => {
        p.rotation.y += spinSpeed * (p.userData.spinDir as number)
      })

      // Scale / altitude from layer (shrink = farther)
      if (P === 'idle' || (P === 'climbing' && L === 0)) {
        targetScale = 1
        targetY = 0.15
        windAmp = 0
      } else if (P === 'climbing' || P === 'done') {
        targetScale = Math.max(0.18, 1 - L * 0.09)
        targetY = 0.15 + L * 0.22
        windAmp = Math.min(0.08, L * 0.012)
      }

      if (P === 'crashing') {
        crashT += 0.04
        drone.rotation.z = Math.sin(crashT * 8) * 0.45
        drone.rotation.x = Math.sin(crashT * 5) * 0.25
        drone.position.x = Math.sin(crashT * 6) * 0.35
        currentY = THREE.MathUtils.lerp(currentY, -1.8, 0.06)
        currentScale = THREE.MathUtils.lerp(currentScale, 0.55, 0.05)
        shadow.material.opacity = THREE.MathUtils.lerp(
          (shadow.material as THREE.MeshBasicMaterial).opacity,
          0,
          0.1,
        )
      } else if (P === 'landing') {
        landT += 0.05
        targetY = 0.15
        targetScale = 1
        drone.rotation.z = Math.sin(landT * 3) * 0.05
        drone.rotation.x = 0
        drone.position.x = THREE.MathUtils.lerp(drone.position.x, 0, 0.1)
      } else {
        crashT = 0
        landT = 0
        bobPhase += 0.035
        drone.rotation.z = Math.sin(bobPhase) * (0.04 + windAmp)
        drone.rotation.x = Math.cos(bobPhase * 0.7) * 0.03
        drone.position.x = Math.sin(bobPhase * 0.5) * windAmp * 2
        ;(shadow.material as THREE.MeshBasicMaterial).opacity =
          0.12 + currentScale * 0.16
      }

      if (P !== 'crashing') {
        currentScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.08)
        currentY = THREE.MathUtils.lerp(currentY, targetY, 0.08)
      }

      drone.scale.setScalar(currentScale)
      drone.position.y = currentY + (P === 'climbing' ? Math.sin(bobPhase) * 0.03 : 0)
      shadow.scale.setScalar(currentScale * 1.2)
      shadow.position.x = drone.position.x

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          const mat = obj.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden
    />
  )
}
