import { describe, expect, it } from 'vitest'
import {
  EMPTY_FACE,
  findSkinFaceBox,
  gazeFromBox,
  sampleFromImageData,
  smileFromBox,
} from './faceSense'

function makeFrame(
  w: number,
  h: number,
  paint: (set: (x: number, y: number, r: number, g: number, b: number) => void) => void,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * w + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  // dark background
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 20
    data[i + 1] = 24
    data[i + 2] = 40
    data[i + 3] = 255
  }
  paint(set)
  return data
}

describe('faceSense', () => {
  it('finds a skin-tone blob as face', () => {
    const w = 80
    const h = 60
    const data = makeFrame(w, h, (set) => {
      for (let y = 10; y < 40; y++) {
        for (let x = 25; x < 55; x++) set(x, y, 210, 160, 140)
      }
    })
    const box = findSkinFaceBox(data, w, h)
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(10)
  })

  it('scores centered gaze higher', () => {
    const a = gazeFromBox({ x: 30, y: 15, width: 40, height: 40 }, 100, 100)
    const b = gazeFromBox({ x: 0, y: 0, width: 20, height: 20 }, 100, 100)
    expect(a.gazeScore).toBeGreaterThan(b.gazeScore)
  })

  it('smile cue rises with bright mouth band', () => {
    const w = 100
    const h = 100
    const box = { x: 20, y: 10, width: 60, height: 70 }
    const calm = makeFrame(w, h, (set) => {
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let x = box.x; x < box.x + box.width; x++) set(x, y, 190, 140, 120)
      }
    })
    const smiling = makeFrame(w, h, (set) => {
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let x = box.x; x < box.x + box.width; x++) set(x, y, 190, 140, 120)
      }
      for (let y = box.y + 45; y < box.y + 65; y++) {
        for (let x = box.x + 10; x < box.x + 50; x++) set(x, y, 240, 220, 200)
      }
    })
    const s0 = smileFromBox(calm, w, box)
    const s1 = smileFromBox(smiling, w, box)
    expect(s1.smileScore).toBeGreaterThan(s0.smileScore)
  })

  it('sampleFromImageData returns empty without face', () => {
    const data = makeFrame(40, 30, () => {})
    expect(sampleFromImageData(data, 40, 30, null)).toEqual(EMPTY_FACE)
  })
})
