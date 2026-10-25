/** Kader Makarası — free-demo push-your-luck chain slot (pure logic). */

export type KaderCard =
  | 'hazine'
  | 'ruzgar'
  | 'bomba'
  | 'sans'
  | 'cokuş'
  | 'kirik'

export type KaderPhase =
  | 'idle'
  | 'spinning'
  | 'choice' // after spin: lock or continue
  | 'break' // kirik: keep head or tail
  | 'locked'
  | 'crashed'

export interface ChainLink {
  id: string
  card: KaderCard
  /** Multiplier contribution of this link (can be negative for rüzgar) */
  delta: number
}

export interface KaderResult {
  outcome: 'locked' | 'crashed'
  multiplier: number
  links: number
  timestamp: number
}

export const CARD_META: Record<
  KaderCard,
  { label: string; hint: string; tone: 'good' | 'wild' | 'bad' | 'rare' }
> = {
  hazine: { label: 'Hazine', hint: 'Zincir güçlenir', tone: 'good' },
  ruzgar: { label: 'Rüzgar', hint: 'Şanslı veya ters', tone: 'wild' },
  bomba: { label: 'Bomba', hint: '1 çöküş kalkanı', tone: 'rare' },
  sans: { label: 'Şans', hint: 'Büyük sıçrama', tone: 'rare' },
  cokuş: { label: 'Çöküş', hint: 'Zincir kırılabilir', tone: 'bad' },
  kirik: { label: 'Kırık', hint: 'Baş mı, son mu?', tone: 'wild' },
}

const BEST_KEY = 'zincir-kader-best-v1'

export function loadKaderBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveKaderBest(mult: number): number {
  const prev = loadKaderBest()
  const next = Math.max(prev, mult)
  try {
    localStorage.setItem(BEST_KEY, String(next))
  } catch {
    // ignore
  }
  return next
}

export function sumMultiplier(links: ChainLink[]): number {
  const raw = 1 + links.reduce((s, l) => s + l.delta, 0)
  return Math.max(0, Math.round(raw * 100) / 100)
}

function uid(): string {
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Weighted draw; crash weight rises with chain length. */
export function drawCard(linkCount: number, rng = Math.random): KaderCard {
  const crashW = Math.min(0.06 + linkCount * 0.045, 0.4)
  const r = rng()
  if (r < crashW) return 'cokuş'
  const t = (r - crashW) / (1 - crashW)
  if (t < 0.32) return 'hazine'
  if (t < 0.52) return 'ruzgar'
  if (t < 0.64) return 'bomba'
  if (t < 0.78) return 'sans'
  return 'kirik'
}

export function makeLink(card: KaderCard, rng = Math.random): ChainLink {
  let delta = 0
  switch (card) {
    case 'hazine':
      delta = 0.25 + rng() * 0.55
      break
    case 'ruzgar':
      delta = rng() < 0.55 ? 0.2 + rng() * 0.35 : -(0.08 + rng() * 0.22)
      break
    case 'bomba':
      delta = 0.05
      break
    case 'sans':
      delta = 0.7 + rng() * 0.9
      break
    case 'cokuş':
      delta = 0
      break
    case 'kirik':
      delta = 0.1 + rng() * 0.2
      break
  }
  return {
    id: uid(),
    card,
    delta: Math.round(delta * 100) / 100,
  }
}

export function applySpin(args: {
  links: ChainLink[]
  shields: number
  card: KaderCard
  rng?: () => number
}): {
  links: ChainLink[]
  shields: number
  phase: Extract<KaderPhase, 'choice' | 'break' | 'crashed'>
  lastLink: ChainLink
} {
  const rng = args.rng ?? Math.random
  const lastLink = makeLink(args.card, rng)
  let shields = args.shields
  let links = [...args.links, lastLink]

  if (args.card === 'bomba') {
    shields = Math.min(2, shields + 1)
    return { links, shields, phase: 'choice', lastLink }
  }

  if (args.card === 'cokuş') {
    if (shields > 0) {
      shields -= 1
      lastLink.delta = 0.05
      return { links, shields, phase: 'choice', lastLink }
    }
    return { links, shields: 0, phase: 'crashed', lastLink }
  }

  if (args.card === 'kirik' && links.length >= 2) {
    return { links, shields, phase: 'break', lastLink }
  }

  return { links, shields, phase: 'choice', lastLink }
}

/** Keep head (early) or tail (recent) half of the chain. */
export function resolveBreak(
  links: ChainLink[],
  keep: 'head' | 'tail',
): ChainLink[] {
  if (links.length < 2) return links
  const mid = Math.floor(links.length / 2)
  return keep === 'head' ? links.slice(0, Math.max(1, mid)) : links.slice(mid)
}

export function fmtMult(n: number): string {
  return `${n.toFixed(2)}x`
}
