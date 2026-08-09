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
    CREATE TABLE IF NOT EXISTS story_media (
      id TEXT PRIMARY KEY,
      png TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

function idGen(): string {
  return `s${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    const sql = sqlClient()
    await ensureTable(sql)
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const id = String(url.searchParams.get('id') || '').slice(0, 32)
      if (!id) {
        return Response.json(
          { error: 'id required' },
          { status: 400, headers: cors },
        )
      }
      const rows = await sql`SELECT png FROM story_media WHERE id = ${id} LIMIT 1`
      const row = rows[0]
      if (!row?.png) {
        return new Response('Not found', { status: 404, headers: cors })
      }
      const bin = Buffer.from(String(row.png), 'base64')
      return new Response(bin, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as { png?: string }
      const png = String(body.png || '')
      if (png.length < 32 || png.length > 2_500_000) {
        return Response.json(
          { error: 'invalid png' },
          { status: 400, headers: cors },
        )
      }
      const id = idGen()
      await sql`
        INSERT INTO story_media (id, png, created_at)
        VALUES (${id}, ${png}, NOW())
      `
      // best-effort cleanup older than 2 days
      await sql`DELETE FROM story_media WHERE created_at < NOW() - INTERVAL '2 days'`
      const publicUrl = `${url.origin}/api/story-media?id=${encodeURIComponent(id)}`
      return Response.json({ id, url: publicUrl }, { headers: cors })
    }

    return Response.json(
      { error: 'method not allowed' },
      { status: 405, headers: cors },
    )
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'story error' },
      { status: 500, headers: cors },
    )
  }
}
