import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { BallState } from '../game/physics'
import type { PlayerDef } from '../game/roster'

interface Props {
  ball: BallState
  tiltX: number
  tiltY: number
  player: PlayerDef
}

export function Arena({ ball, tiltX, tiltY, player }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const ref = useRef({ ball, tiltX, tiltY, player })
  ref.current = { ball, tiltX, tiltY, player }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0a1620, 0.04)

    const camera = new THREE.PerspectiveCamera(
      68,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      60,
    )
    camera.position.set(0, 1.3, 0.25)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xc8e0f0, 0x1a2332, 1.05))
    const sun = new THREE.DirectionalLight(0xffffff, 1.15)
    sun.position.set(4, 7, 2)
    scene.add(sun)

    const pitch = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a5c38, roughness: 0.9 }),
    )
    pitch.rotation.x = -Math.PI / 2
    scene.add(pitch)

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.8, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    scene.add(ring)

    // Player figure (stylized)
    const figure = new THREE.Group()
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.45, 6, 10),
      new THREE.MeshStandardMaterial({ color: player.kit, metalness: 0.2 }),
    )
    torso.position.set(0, 0.85, -0.95)
    figure.add(torso)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8c4a8 }),
    )
    head.position.set(0, 1.35, -0.95)
    figure.add(head)
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.12, 0.28),
      new THREE.MeshStandardMaterial({
        color: player.accent,
        emissive: player.accent,
        emissiveIntensity: 0.35,
      }),
    )
    shoe.position.set(0, 0.4, -1.15)
    figure.add(shoe)
    scene.add(figure)

    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.4 }),
    )
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.01, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x111827 }),
    )
    ballMesh.add(seam)
    scene.add(ballMesh)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    scene.add(shadow)

    let disposed = false
    let raf = 0
    const onResize = () => {
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
      const s = ref.current

      camera.rotation.order = 'YXZ'
      camera.rotation.y = -s.tiltX * 0.45
      camera.rotation.x = -s.tiltY * 0.3

      // Update kit color if player changed
      ;(torso.material as THREE.MeshStandardMaterial).color.setHex(s.player.kit)
      ;(shoe.material as THREE.MeshStandardMaterial).color.setHex(s.player.accent)
      ;(shoe.material as THREE.MeshStandardMaterial).emissive.setHex(s.player.accent)

      ballMesh.position.set(s.ball.x, s.ball.y, s.ball.z)
      ballMesh.rotation.x += 0.09
      shadow.position.set(s.ball.x, 0.03, s.ball.z)
      shadow.scale.setScalar(Math.max(0.35, 1.15 - s.ball.y * 0.3))

      figure.position.x = s.tiltX * 0.12
      shoe.rotation.z = -s.tiltX * 0.25

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [player.id])

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />
}
