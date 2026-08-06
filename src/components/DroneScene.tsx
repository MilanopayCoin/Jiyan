import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CraftId, CraftSkinId, FlightPhase, LedLevel } from '../game/types'
import { CRAFTS, SKINS } from '../game/vehicles'

interface Props {
  layer: number
  phase: FlightPhase
  led: LedLevel
  craftId: CraftId
  skinId: CraftSkinId
  className?: string
}

const LED_COLORS: Record<LedLevel, number> = {
  safe: 0x3dffa8,
  caution: 0xffb84d,
  critical: 0xff4d6a,
}

type CraftParts = {
  group: THREE.Group
  props: THREE.Mesh[]
  leds: THREE.Mesh[]
}

function mats(skinId: CraftSkinId) {
  const skin = SKINS[skinId]
  const bodyMat = new THREE.MeshStandardMaterial({
    color: skin.bodyColor,
    metalness: 0.7,
    roughness: 0.35,
    emissive: skin.emissiveBoost ? skin.accentColor : 0x000000,
    emissiveIntensity: skin.emissiveBoost ?? 0,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: skin.accentColor,
    metalness: 0.5,
    roughness: 0.4,
    emissive: skin.accentColor,
    emissiveIntensity: 0.15 + (skin.emissiveBoost ?? 0),
  })
  return { bodyMat, accentMat, skin }
}

function createDrone(skinId: CraftSkinId): CraftParts {
  const { bodyMat, accentMat } = mats(skinId)
  const group = new THREE.Group()

  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55), bodyMat))

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

  const armPositions: [number, number][] = [
    [0.42, 0.42],
    [0.42, -0.42],
    [-0.42, 0.42],
    [-0.42, -0.42],
  ]
  const props: THREE.Mesh[] = []
  const leds: THREE.Mesh[] = []

  armPositions.forEach(([x, z], i) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.55), accentMat)
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

  ;[-0.22, 0.22].forEach((z) => {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), accentMat)
    skid.position.set(0, -0.14, z)
    group.add(skid)
  })

  return { group, props, leds }
}

function createPlane(skinId: CraftSkinId): CraftParts {
  const { bodyMat, accentMat } = mats(skinId)
  const group = new THREE.Group()
  const props: THREE.Mesh[] = []
  const leds: THREE.Mesh[] = []

  const fuselage = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.7, 6, 12),
    bodyMat,
  )
  fuselage.rotation.z = Math.PI / 2
  group.add(fuselage)

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.28), accentMat)
  wing.position.y = 0.02
  group.add(wing)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.16), accentMat)
  tail.position.set(-0.38, 0.08, 0)
  group.add(tail)

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.14), bodyMat)
  fin.position.set(-0.4, 0.18, 0)
  group.add(fin)

  const prop = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xdfe7ef, metalness: 0.4 }),
  )
  prop.position.set(0.48, 0, 0)
  prop.userData.spinDir = 1
  prop.userData.spinAxis = 'x'
  group.add(prop)
  props.push(prop)

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 10),
    new THREE.MeshStandardMaterial({
      color: LED_COLORS.safe,
      emissive: LED_COLORS.safe,
      emissiveIntensity: 1.4,
    }),
  )
  led.position.set(0.2, 0.08, 0)
  group.add(led)
  leds.push(led)

  return { group, props, leds }
}

function createRocket(skinId: CraftSkinId): CraftParts {
  const { bodyMat, accentMat } = mats(skinId)
  const group = new THREE.Group()
  const props: THREE.Mesh[] = []
  const leds: THREE.Mesh[] = []

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.85, 14), bodyMat)
  group.add(body)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 14), accentMat)
  nose.position.y = 0.58
  group.add(nose)

  ;[-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.22), accentMat)
    fin.position.set(side * 0.22, -0.28, 0)
    group.add(fin)
  })
  const finZ = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.06), accentMat)
  finZ.position.set(0, -0.28, 0.22)
  group.add(finZ)

  // Exhaust flicker disc (spins as "prop" stand-in)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.35, 10),
    new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      emissive: 0xff6b35,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.85,
    }),
  )
  flame.position.y = -0.55
  flame.rotation.x = Math.PI
  flame.userData.spinDir = 1
  flame.userData.pulse = true
  group.add(flame)
  props.push(flame)

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshStandardMaterial({
      color: LED_COLORS.safe,
      emissive: LED_COLORS.safe,
      emissiveIntensity: 1.4,
    }),
  )
  led.position.set(0, 0.2, 0.18)
  group.add(led)
  leds.push(led)

  return { group, props, leds }
}

function createBalloon(skinId: CraftSkinId): CraftParts {
  const { bodyMat, accentMat } = mats(skinId)
  const group = new THREE.Group()
  const props: THREE.Mesh[] = []
  const leds: THREE.Mesh[] = []

  const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), bodyMat)
  balloon.position.y = 0.35
  group.add(balloon)

  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), accentMat)
  basket.position.y = -0.28
  group.add(basket)

  ;[
    [0.12, 0.12],
    [0.12, -0.12],
    [-0.12, 0.12],
    [-0.12, -0.12],
  ].forEach(([x, z]) => {
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: 0xc4b59a }),
    )
    rope.position.set(x, 0.05, z)
    group.add(rope)
  })

  // Gentle sway marker
  const sway = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshStandardMaterial({
      color: accentMat.color,
      transparent: true,
      opacity: 0.01,
    }),
  )
  sway.userData.spinDir = 1
  sway.userData.pulse = true
  group.add(sway)
  props.push(sway)

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 10),
    new THREE.MeshStandardMaterial({
      color: LED_COLORS.safe,
      emissive: LED_COLORS.safe,
      emissiveIntensity: 1.4,
    }),
  )
  led.position.set(0, -0.2, 0.12)
  group.add(led)
  leds.push(led)

  return { group, props, leds }
}

function createCraft(craftId: CraftId, skinId: CraftSkinId): CraftParts {
  switch (craftId) {
    case 'plane':
      return createPlane(skinId)
    case 'rocket':
      return createRocket(skinId)
    case 'balloon':
      return createBalloon(skinId)
    default:
      return createDrone(skinId)
  }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

export function DroneScene({
  layer,
  phase,
  led,
  craftId,
  skinId,
  className = '',
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ layer, phase, led, craftId, skinId })
  stateRef.current = { layer, phase, led, craftId, skinId }

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
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.setAttribute('data-share-gl', '1')
    mount.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x1a2332, 1.1)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(2, 4, 3)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x3dffa8, 0.35)
    rim.position.set(-2, 1, -2)
    scene.add(rim)

    let craft = createCraft(craftId, skinId)
    craft.group.position.set(0, 0.15, 0)
    scene.add(craft.group)

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

    let currentKey = `${craftId}:${skinId}`
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
      craft.leds.forEach((ledMesh) => {
        const mat = ledMesh.material as THREE.MeshStandardMaterial
        mat.color.setHex(c)
        mat.emissive.setHex(c)
        mat.emissiveIntensity = level === 'critical' ? 2.2 : 1.4
      })
    }

    const swapCraft = (id: CraftId, skin: CraftSkinId) => {
      scene.remove(craft.group)
      disposeObject(craft.group)
      craft = createCraft(id, skin)
      craft.group.position.set(0, currentY, 0)
      craft.group.scale.setScalar(currentScale)
      scene.add(craft.group)
      currentKey = `${id}:${skin}`
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
      const {
        layer: L,
        phase: P,
        led: ledLevel,
        craftId: cid,
        skinId: sid,
      } = stateRef.current

      if (`${cid}:${sid}` !== currentKey) swapCraft(cid, sid)

      applyLed(ledLevel)
      const visual = CRAFTS[cid].climbVisual

      const spinSpeed =
        P === 'crashing' ? 0.08 : P === 'landing' ? 0.15 : 0.35 * visual
      craft.props.forEach((p) => {
        const dir = (p.userData.spinDir as number) || 1
        if (p.userData.spinAxis === 'x') p.rotation.x += spinSpeed * dir
        else if (p.userData.pulse) {
          const mat = p.material as THREE.MeshStandardMaterial
          if (mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = 1.2 + Math.sin(bobPhase * 4) * 0.8
          }
          p.scale.y = 1 + Math.sin(bobPhase * 5) * 0.15
        } else p.rotation.y += spinSpeed * dir
      })

      if (P === 'idle' || (P === 'climbing' && L === 0)) {
        targetScale = 1
        targetY = 0.15
        windAmp = 0
      } else if (P === 'climbing' || P === 'done') {
        targetScale = Math.max(0.18, 1 - L * 0.09 * Math.min(visual, 1.3))
        targetY = 0.15 + L * 0.22 * visual
        // Altitude wind grows with layer — stronger sway / turbulence
        windAmp = Math.min(0.22, L * 0.028 + (ledLevel === 'critical' ? 0.04 : 0))
      }

      if (P === 'crashing') {
        crashT += 0.04
        craft.group.rotation.z = Math.sin(crashT * 8) * 0.45
        craft.group.rotation.x = Math.sin(crashT * 5) * 0.25
        craft.group.position.x = Math.sin(crashT * 6) * 0.35
        currentY = THREE.MathUtils.lerp(currentY, -1.8, 0.06)
        currentScale = THREE.MathUtils.lerp(currentScale, 0.55, 0.05)
        ;(shadow.material as THREE.MeshBasicMaterial).opacity =
          THREE.MathUtils.lerp(
            (shadow.material as THREE.MeshBasicMaterial).opacity,
            0,
            0.1,
          )
      } else if (P === 'landing') {
        landT += 0.05
        targetY = 0.15
        targetScale = 1
        craft.group.rotation.z = Math.sin(landT * 3) * 0.05
        craft.group.rotation.x = 0
        craft.group.position.x = THREE.MathUtils.lerp(craft.group.position.x, 0, 0.1)
      } else {
        crashT = 0
        landT = 0
        const windSpeed = 0.035 + windAmp * 0.6
        bobPhase += windSpeed * (cid === 'balloon' ? 0.7 : 1)
        const gust = Math.sin(bobPhase * 2.3) * windAmp * 0.5
        craft.group.rotation.z =
          Math.sin(bobPhase) * (0.04 + windAmp) + gust * 0.4
        craft.group.rotation.x =
          Math.cos(bobPhase * 0.7) * (0.03 + windAmp * 0.35)
        craft.group.position.x =
          Math.sin(bobPhase * 0.5) * windAmp * 3.2 +
          Math.sin(bobPhase * 3.1) * windAmp * 0.8
        craft.group.position.z = Math.cos(bobPhase * 1.1) * windAmp * 0.6
        ;(shadow.material as THREE.MeshBasicMaterial).opacity =
          0.12 + currentScale * 0.16
      }

      if (P !== 'crashing') {
        currentScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.08)
        currentY = THREE.MathUtils.lerp(currentY, targetY, 0.08)
      }

      craft.group.scale.setScalar(currentScale)
      craft.group.position.y =
        currentY + (P === 'climbing' ? Math.sin(bobPhase) * 0.03 : 0)
      shadow.scale.setScalar(currentScale * 1.2)
      shadow.position.x = craft.group.position.x

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      disposeObject(craft.group)
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
    // Mount once; craft swaps handled in tick via stateRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={mountRef}
      data-drone-canvas
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden
    />
  )
}
