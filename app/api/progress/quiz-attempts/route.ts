import { NextResponse, type NextRequest } from 'next/server'

import { AuthError, requireStudent, unauthorized } from '@/lib/server/auth'
import { getQuizAttempt, saveQuizAttemptForUser } from '@/lib/server/progress'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const student = await requireStudent()
    const topicId = request.nextUrl.searchParams.get('topicId')
    if (!topicId) return NextResponse.json({ error: 'topic_id_required' }, { status: 400 })
    return NextResponse.json({ quizAttempt: await getQuizAttempt(student.id, topicId) })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const student = await requireStudent()
    const body = await request.json()
    return NextResponse.json({ quizAttempt: await saveQuizAttemptForUser(student.id, body) })
  } catch (error) {
    if (error instanceof AuthError) return unauthorized()
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
