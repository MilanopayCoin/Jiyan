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

async function ensure(sql: ReturnType<typeof sqlClient>) {
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_league (
      week_key TEXT NOT NULL,
      pilot_id TEXT NOT NULL,
      name TEXT NOT NULL,
      best_multiplier DOUBLE PRECISION NOT NULL DEFAULT 0,
      best_layer INT NOT NULL DEFAULT 0,
      flights INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (week_key, pilot_id)
    )
  `
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    const sql = sqlClient()
    await ensure(sql)
    const url = new URL(req.url)
    let weekKey = (url.searchParams.get('week') || '').slice(0, 12)

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        weekKey?: string
        pilotId?: string
        name?: string
        bestMultiplier?: number
        bestLayer?: number
        flights?: number
      }
      weekKey = String(body.weekKey || weekKey).slice(0, 12)
      const pilotId = String(body.pilotId || '').slice(0, 32)
      if (!weekKey || !pilotId) {
        return Response.json(
          { error: 'weekKey and pilotId required' },
          { status: 400, headers: cors },
        )
      }
      const name = String(body.name || 'Pilot').slice(0, 16)
      const bestMultiplier = Math.max(0, Number(body.bestMultiplier) || 0)
      const bestLayer = Math.max(0, Number(body.bestLayer) | 0)
      const flights = Math.max(0, Number(body.flights) | 0)

      await sql`
        INSERT INTO weekly_league (week_key, pilot_id, name, best_multiplier, best_layer, flights, updated_at)
        VALUES (${weekKey}, ${pilotId}, ${name}, ${bestMultiplier}, ${bestLayer}, ${flights}, NOW())
        ON CONFLICT (week_key, pilot_id) DO UPDATE SET
          name = EXCLUDED.name,
          best_multiplier = GREATEST(weekly_league.best_multiplier, EXCLUDED.best_multiplier),
          best_layer = GREATEST(weekly_league.best_layer, EXCLUDED.best_layer),
          flights = GREATEST(weekly_league.flights, EXCLUDED.flights),
          updated_at = NOW()
      `
    }

    if (!weekKey) {
      return Response.json(
        { error: 'week required' },
        { status: 400, headers: cors },
      )
    }

    const rows = await sql`
      SELECT pilot_id, name, best_multiplier, best_layer, flights, updated_at
      FROM weekly_league
      WHERE week_key = ${weekKey} AND best_multiplier > 0
      ORDER BY best_multiplier DESC
      LIMIT 25
    `

    return Response.json(
      {
        weekKey,
        pilots: rows.map((r, i) => ({
          id: r.pilot_id as string,
          name: r.name as string,
          bestMultiplier: Number(r.best_multiplier),
          bestLayer: Number(r.best_layer),
          streak: Number(r.flights),
          rank: i + 1,
          updatedAt: new Date(r.updated_at as string).getTime(),
        })),
      },
      { headers: cors },
    )
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'league error' },
      { status: 500, headers: cors },
    )
  }
}
