import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { BallState } from '../game/vrPhysics'

interface Props {
  ball: BallState
  lookX: number
  lookY: number
  playing: boolean
  className?: string
}

export function VrArenaScene({
  ball,
  lookX,
  lookY,
  playing,
  className = '',
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ ball, lookX, lookY, playing })
  stateRef.current = { ball, lookX, lookY, playing }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x071018, 0.045)

    const camera = new THREE.PerspectiveCamera(
      70,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      80,
    )
    camera.position.set(0, 1.35, 0.2)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xb8d4f0, 0x1a2332, 1.05))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(3, 6, 2)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x3dffa8, 0.35)
    rim.position.set(-2, 2, -3)
    scene.add(rim)

    // Pitch ground
    const pitch = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1a5c38,
        roughness: 0.85,
        metalness: 0.05,
      }),
    )
    pitch.rotation.x = -Math.PI / 2
    pitch.position.y = 0
    scene.add(pitch)

    // Center ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    scene.add(ring)

    // Goal (simple)
    const goalMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef5,
      metalness: 0.4,
      roughness: 0.4,
    })
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), goalMat)
    postL.position.set(-1.5, 0.7, -10)
    const postR = postL.clone()
    postR.position.x = 1.5
    const cross = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.08, 0.08), goalMat)
    cross.position.set(0, 1.4, -10)
    scene.add(postL, postR, cross)

    // Bumper / "car nose" in front of player
    const bumper = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x1a2332,
        metalness: 0.65,
        roughness: 0.35,
      }),
    )
    body.position.set(0, 0.55, -1.15)
    bumper.add(body)
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.06, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x3dffa8,
        emissive: 0x3dffa8,
        emissiveIntensity: 0.5,
      }),
    )
    accent.position.set(0, 0.62, -1.0)
    bumper.add(accent)
    scene.add(bumper)

    // Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 20),
      new THREE.MeshStandardMaterial({
        color: 0xf5f7fa,
        roughness: 0.45,
        metalness: 0.15,
      }),
    )
    // Pentagons hint via darker band
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.012, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x111827 }),
    )
    ballMesh.add(band)
    scene.add(ballMesh)

    // Shadow under ball
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
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
      const s = stateRef.current

      // Camera look from gyro
      camera.rotation.order = 'YXZ'
      camera.rotation.y = -s.lookX * 0.55
      camera.rotation.x = -s.lookY * 0.35

      ballMesh.position.set(s.ball.x, s.ball.y, s.ball.z)
      ballMesh.rotation.x += 0.08
      ballMesh.rotation.z += 0.05

      shadow.position.set(s.ball.x, 0.03, s.ball.z)
      const shScale = Math.max(0.35, 1.2 - s.ball.y * 0.35)
      shadow.scale.setScalar(shScale)
      ;(shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.08,
        0.35 - s.ball.y * 0.08,
      )

      bumper.position.x = s.lookX * 0.15
      bumper.rotation.y = -s.lookX * 0.2

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
      className={`absolute inset-0 ${className}`}
      aria-hidden
    />
  )
}
