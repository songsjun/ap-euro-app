import { NextResponse, type NextRequest } from 'next/server'

import { AuthError, requireStudent, unauthorized } from '@/lib/server/auth'
import { listTopicUnlocks, unlockSectionForUser } from '@/lib/server/progress'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const student = await requireStudent()
    return NextResponse.json({ topicUnlocks: await listTopicUnlocks(student.id) })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    throw error
  }
}

export async function PUT(request: NextRequest) {
  try {
    const student = await requireStudent()
    const body = await request.json()
    return NextResponse.json({ topicUnlock: await unlockSectionForUser(student.id, body) })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
