import type { Context } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function sqlClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')
  return neon(url)
}

async function ensureTable(sql: ReturnType<typeof sqlClient>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS duels (
      duel_id TEXT NOT NULL,
      pilot_id TEXT NOT NULL,
      name TEXT NOT NULL,
      multiplier DOUBLE PRECISION NOT NULL DEFAULT 0,
      layer INT NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      day_key TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (duel_id, pilot_id)
    )
  `
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    const sql = sqlClient()
    await ensureTable(sql)
    const url = new URL(req.url)
    let duelId = (url.searchParams.get('id') || '')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 16)

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        duelId?: string
        pilotId?: string
        name?: string
        multiplier?: number
        layer?: number
        outcome?: string
        dayKey?: string
      }
      duelId = String(body.duelId || '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 16)
      const pilotId = String(body.pilotId || '').slice(0, 32)
      if (!duelId || !pilotId) {
        return Response.json(
          { error: 'duelId and pilotId required' },
          { status: 400, headers: cors },
        )
      }
      const name = String(body.name || 'Pilot').slice(0, 16)
      const multiplier = Math.max(0, Number(body.multiplier) || 0)
      const layer = Math.max(0, Number(body.layer) | 0)
      const outcome = body.outcome === 'cashed' ? 'cashed' : 'crashed'
      const dayKey = body.dayKey ? String(body.dayKey).slice(0, 10) : null

      await sql`
        INSERT INTO duels (duel_id, pilot_id, name, multiplier, layer, outcome, day_key, updated_at)
        VALUES (${duelId}, ${pilotId}, ${name}, ${multiplier}, ${layer}, ${outcome}, ${dayKey}, NOW())
        ON CONFLICT (duel_id, pilot_id) DO UPDATE SET
          name = EXCLUDED.name,
          multiplier = EXCLUDED.multiplier,
          layer = EXCLUDED.layer,
          outcome = EXCLUDED.outcome,
          day_key = EXCLUDED.day_key,
          updated_at = NOW()
      `
    }

    if (!duelId) {
      return Response.json(
        { error: 'id required' },
        { status: 400, headers: cors },
      )
    }

    const rows = await sql`
      SELECT pilot_id, name, multiplier, layer, outcome, updated_at
      FROM duels WHERE duel_id = ${duelId}
      ORDER BY updated_at ASC
      LIMIT 8
    `

    return Response.json(
      {
        id: duelId,
        scores: rows.map((r) => ({
          pilotId: r.pilot_id as string,
          name: r.name as string,
          multiplier: Number(r.multiplier),
          layer: Number(r.layer),
          outcome: r.outcome as string,
          at: new Date(r.updated_at as string).getTime(),
        })),
      },
      { headers: cors },
    )
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'duel error' },
      { status: 500, headers: cors },
    )
  }
}
