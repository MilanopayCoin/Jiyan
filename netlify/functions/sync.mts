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

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    const sql = sqlClient()
    const url = new URL(req.url)

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        id?: string
        name?: string
        bestMultiplier?: number
        bestLayer?: number
        streak?: number
        dailyBest?: number
        dailyLayer?: number
        dayKey?: string
      }
      if (!body.id || typeof body.name !== 'string') {
        return Response.json(
          { error: 'id and name required' },
          { status: 400, headers: cors },
        )
      }
      const id = String(body.id).slice(0, 32)
      const name = body.name.slice(0, 16) || 'Pilot'
      const bestMultiplier = Math.max(0, Number(body.bestMultiplier) || 0)
      const bestLayer = Math.max(0, Number(body.bestLayer) | 0)
      const streak = Math.max(0, Number(body.streak) | 0)
      const dailyBest = Math.max(0, Number(body.dailyBest) || 0)
      const dailyLayer = Math.max(0, Number(body.dailyLayer) | 0)
      const dayKey = body.dayKey ? String(body.dayKey).slice(0, 10) : null

      await sql`
        INSERT INTO pilots (id, name, best_multiplier, best_layer, streak, daily_best, daily_layer, day_key, updated_at)
        VALUES (${id}, ${name}, ${bestMultiplier}, ${bestLayer}, ${streak}, ${dailyBest}, ${dailyLayer}, ${dayKey}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          best_multiplier = GREATEST(pilots.best_multiplier, EXCLUDED.best_multiplier),
          best_layer = GREATEST(pilots.best_layer, EXCLUDED.best_layer),
          streak = EXCLUDED.streak,
          daily_best = CASE
            WHEN EXCLUDED.day_key IS NOT NULL AND EXCLUDED.day_key = pilots.day_key
              THEN GREATEST(pilots.daily_best, EXCLUDED.daily_best)
            WHEN EXCLUDED.day_key IS NOT NULL
              THEN EXCLUDED.daily_best
            ELSE pilots.daily_best
          END,
          daily_layer = CASE
            WHEN EXCLUDED.day_key IS NOT NULL AND EXCLUDED.day_key = pilots.day_key
              THEN GREATEST(pilots.daily_layer, EXCLUDED.daily_layer)
            WHEN EXCLUDED.day_key IS NOT NULL
              THEN EXCLUDED.daily_layer
            ELSE pilots.daily_layer
          END,
          day_key = COALESCE(EXCLUDED.day_key, pilots.day_key),
          updated_at = NOW()
      `
      return Response.json({ ok: true }, { headers: cors })
    }

    // GET ?ids=a,b,c  or  ?daily=YYYY-MM-DD  or  ?top=1
    const idsParam = url.searchParams.get('ids')
    const daily = url.searchParams.get('daily')
    const top = url.searchParams.get('top')

    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40)
      if (ids.length === 0) {
        return Response.json({ pilots: [] }, { headers: cors })
      }
      const rows = await sql`
        SELECT id, name, best_multiplier, best_layer, streak, daily_best, daily_layer, day_key, updated_at
        FROM pilots WHERE id = ANY(${ids})
      `
      return Response.json({ pilots: rows }, { headers: cors })
    }

    if (daily) {
      const rows = await sql`
        SELECT id, name, best_multiplier, best_layer, streak, daily_best, daily_layer, day_key, updated_at
        FROM pilots
        WHERE day_key = ${daily} AND daily_best > 0
        ORDER BY daily_best DESC
        LIMIT 25
      `
      return Response.json({ pilots: rows }, { headers: cors })
    }

    if (top) {
      const rows = await sql`
        SELECT id, name, best_multiplier, best_layer, streak, daily_best, daily_layer, day_key, updated_at
        FROM pilots
        WHERE best_multiplier > 0
        ORDER BY best_multiplier DESC
        LIMIT 25
      `
      return Response.json({ pilots: rows }, { headers: cors })
    }

    return Response.json({ error: 'ids, daily, or top required' }, { status: 400, headers: cors })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'server error'
    return Response.json({ error: message }, { status: 500, headers: cors })
  }
}
