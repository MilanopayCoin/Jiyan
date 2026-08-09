import type { Context } from '@netlify/functions'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return Response.json(
      { error: 'POST only' },
      { status: 405, headers: cors },
    )
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return Response.json(
      { error: 'TELEGRAM_BOT_TOKEN not configured', demo: true },
      { status: 503, headers: cors },
    )
  }

  try {
    const body = (await req.json()) as {
      stars?: number
      title?: string
      description?: string
    }
    const stars = Math.min(2500, Math.max(1, Math.floor(Number(body.stars) || 50)))
    const title = String(body.title || 'Zincir Stars').slice(0, 32)
    const description = String(
      body.description || 'Zincir: Drone uçuş bakiyesi',
    ).slice(0, 255)

    const payload = {
      title,
      description,
      payload: `stars_${stars}_${Date.now()}`,
      currency: 'XTR',
      prices: [{ label: `${stars} Stars`, amount: stars }],
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    const data = (await tgRes.json()) as {
      ok?: boolean
      result?: string
      description?: string
    }
    if (!data.ok || !data.result) {
      return Response.json(
        { error: data.description || 'createInvoiceLink failed' },
        { status: 502, headers: cors },
      )
    }
    return Response.json({ invoiceUrl: data.result }, { headers: cors })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invoice error' },
      { status: 500, headers: cors },
    )
  }
}
