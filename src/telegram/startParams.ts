/** Parse Telegram Mini App start_param payloads (≤64 chars). */

export type StartKind =
  | { kind: 'ref'; pilotId: string }
  | { kind: 'duel'; duelId: string }
  | { kind: 'chatBlind'; token: string }
  | { kind: 'boost' }

export function parseStartParam(param: string | null | undefined): StartKind | null {
  if (!param) return null
  const p = param.trim()
  if (p === 'boost' || p === 'boost1') return { kind: 'boost' }
  let m = p.match(/^ref_([A-Za-z0-9_-]{4,58})$/)
  if (m) return { kind: 'ref', pilotId: m[1] }
  m = p.match(/^d_([A-Za-z0-9_-]{4,16})$/)
  if (m) return { kind: 'duel', duelId: m[1] }
  m = p.match(/^cb_([A-Za-z0-9_-]{4,24})$/)
  if (m) return { kind: 'chatBlind', token: m[1] }
  return null
}

export function makeDuelStartParam(duelId: string): string {
  return `d_${duelId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)}`
}

export function makeChatBlindStartParam(token: string): string {
  return `cb_${token.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24)}`
}
