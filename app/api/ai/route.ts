import { NextResponse, type NextRequest } from 'next/server'

import { AuthError, requireStudent, unauthorized } from '@/lib/server/auth'
import { loadEnvFiles } from '@/lib/server/env'

export const runtime = 'nodejs'

loadEnvFiles()

function unavailable(errorType: string, status = 503): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      text: '',
      parsed_json: null,
      error_type: errorType,
    },
    { status },
  )
}

export async function POST(request: NextRequest) {
  try {
    await requireStudent()
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    throw error
  }

  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (!gatewayUrl) return unavailable('ai_gateway_not_configured')

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return unavailable('bad_request', 400)
  }

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.AI_GATEWAY_TOKEN
          ? { authorization: `Bearer ${process.env.AI_GATEWAY_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
    })

    const text = await response.text()
    const contentType = response.headers.get('content-type') ?? 'application/json'
    return new NextResponse(text, {
      status: response.status,
      headers: { 'content-type': contentType },
    })
  } catch {
    return unavailable('ai_gateway_unreachable')
  }
}
