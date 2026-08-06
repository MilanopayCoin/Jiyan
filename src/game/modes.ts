export type VrModeId = 'hattrick' | 'keepy' | 'lasttouch' | 'freefire'

export interface VrModeDef {
  id: VrModeId
  name: string
  tagline: string
  blurb: string
  /** Multiplier growth per successful touch */
  multStep: number
  /** Starting multiplier */
  multStart: number
  /** Gravity strength */
  gravity: number
  /** How forgiving the kick hitbox is (0–1) */
  hitForgive: number
  /** Max idle air time before auto-drop (ms) — keepy uses this */
  maxAirMs?: number
  riskLabel: string
}

export const VR_MODES: Record<VrModeId, VrModeDef> = {
  hattrick: {
    id: 'hattrick',
    name: 'Hat-trick Crash',
    tagline: 'VR risk-ödül sektirme',
    blurb:
      'Her sektirmede çarpan artar. İstediğin an KİLİTLE — top düşerse sıfır. Zincir ruhu, Messi dokunuşu.',
    multStep: 0.35,
    multStart: 1,
    gravity: 9.5,
    hitForgive: 0.42,
    riskLabel: 'Yüksek ödül · yüksek risk',
  },
  keepy: {
    id: 'keepy',
    name: 'Keepy-Uppi Drift',
    tagline: 'VR dayanıklılık',
    blurb:
      'Topu mümkün olduğunca uzun havada tut. Telefonu eğerek dengele — combo süresi = skor.',
    multStep: 0.12,
    multStart: 1,
    gravity: 7.2,
    hitForgive: 0.5,
    maxAirMs: 2800,
    riskLabel: 'Orta risk · uzun combo',
  },
  lasttouch: {
    id: 'lasttouch',
    name: 'Last Touch',
    tagline: 'VR zamanlama',
    blurb:
      'Top zirvedeyken Sektir. Perfect timing = büyük çarpan; erken/geç = zayıf sektirme.',
    multStep: 0.55,
    multStart: 1,
    gravity: 8.5,
    hitForgive: 0.38,
    riskLabel: 'Skill tabanlı',
  },
  freefire: {
    id: 'freefire',
    name: 'Free Kick VR',
    tagline: 'VR kıvırma şutu',
    blurb:
      'Bakışını köşeye hizala, şut zamanla. Duvarı aşıp kale köşesine isabet = yüksek çarpan.',
    multStep: 0.8,
    multStart: 1.2,
    gravity: 10,
    hitForgive: 0.35,
    riskLabel: 'Tek şans · yüksek tavan',
  },
}

export const VR_MODE_ORDER: VrModeId[] = [
  'hattrick',
  'keepy',
  'lasttouch',
  'freefire',
]
