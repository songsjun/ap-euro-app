import { NextResponse } from 'next/server'

import { AuthError, requireStudent, unauthorized } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const student = await requireStudent()
    return NextResponse.json({ authenticated: true, student })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    throw error
  }
}
