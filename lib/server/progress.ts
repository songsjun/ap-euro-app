import type { PoolClient, QueryResultRow } from 'pg'

import type { Completion, QuizAttempt, QuizPartGrade } from '@/lib/types'

import {
  isValidResourceId,
  isValidSectionId,
  isValidTopicId,
  prerequisiteSectionForUnlock,
  requiredResourceIdsForSection,
} from './catalog'
import { query, transaction } from './db'
import { ensureSchema } from './schema'

interface CompletionRow {
  user_id: string
  resource_id: string
  status: Completion['status']
  score: number | null
  score_max: number | null
  completed_at: string | Date
}

interface TopicUnlockRow {
  user_id: string
  section_id: string
  unlocked_at: string | Date
}

interface QuizAttemptRow {
  user_id: string
  topic_id: string
  attempted_at: string | Date
  mcq_score: number | null
  mcq_total: number | null
  mcq_answers: string[] | null
  saq_parts: Array<QuizPartGrade | null> | null
  reflect: QuizPartGrade | null
  skill_parts: Array<QuizPartGrade | null> | null
}

export interface TopicUnlockRecord {
  user_id: string
  section_id: string
  unlocked_at: string
}

export interface ProgressCommitResult {
  completions: Completion[]
  topicUnlocks: TopicUnlockRecord[]
}

interface CompletionInput {
  user_id?: unknown
  resource_id: string
  status: Completion['status']
  score?: number
  score_max?: number
  completed_at: string
}

interface TopicUnlockInput {
  section_id: string
  unlocked_at: string
}

interface QuizAttemptPatch {
  user_id?: unknown
  topic_id: string
  attempted_at: string
  reset: boolean
  payload: Partial<Pick<QuizAttempt, 'mcq_score' | 'mcq_total' | 'mcq_answers' | 'saq_parts' | 'reflect' | 'skill_parts'>>
}

const QUIZ_FIELDS = ['mcq_score', 'mcq_total', 'mcq_answers', 'saq_parts', 'reflect', 'skill_parts'] as const

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function assertMatchingUser(record: { user_id?: unknown }, userId: string): void {
  if (typeof record.user_id === 'string' && record.user_id !== userId) {
    throw new Error('bad_user_id')
  }
}

function optionalFiniteNumber(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`bad_${name}`)
  return value
}

function optionalInteger(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`bad_${name}`)
  return value as number
}

function validateDate(value: unknown, name: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`bad_${name}`)
  return value
}

function validateCompletionInput(userId: string, input: unknown): CompletionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bad_completion')
  const record = input as Partial<Completion>
  assertMatchingUser(record, userId)
  if (!record.resource_id || typeof record.resource_id !== 'string' || !isValidResourceId(record.resource_id)) {
    throw new Error('bad_resource_id')
  }
  if (record.status !== 'passed' && record.status !== 'failed' && record.status !== 'skipped') {
    throw new Error('bad_status')
  }

  return {
    user_id: record.user_id,
    resource_id: record.resource_id,
    status: record.status,
    score: optionalFiniteNumber(record.score, 'score'),
    score_max: optionalFiniteNumber(record.score_max, 'score_max'),
    completed_at: validateDate(record.completed_at, 'completed_at'),
  }
}

function validateTopicUnlockInput(input: unknown): TopicUnlockInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bad_unlock')
  const record = input as { section_id?: unknown; unlocked_at?: unknown }
  if (!record.section_id || typeof record.section_id !== 'string' || !isValidSectionId(record.section_id)) {
    throw new Error('bad_section_id')
  }
  const unlockedAt = typeof record.unlocked_at === 'string' && !Number.isNaN(Date.parse(record.unlocked_at))
    ? record.unlocked_at
    : new Date().toISOString()
  return { section_id: record.section_id, unlocked_at: unlockedAt }
}

function validateMcqAnswers(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('bad_mcq_answers')
  return value.map(answer => {
    if (typeof answer !== 'string' || !/^[A-D]$/.test(answer)) throw new Error('bad_mcq_answers')
    return answer
  })
}

function validatePartGrade(value: unknown, name: string): QuizPartGrade {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`bad_${name}`)
  const record = value as Partial<QuizPartGrade>
  if (typeof record.answer !== 'string' || record.answer.length > 10_000) throw new Error(`bad_${name}`)
  if (record.score !== 0 && record.score !== 1) throw new Error(`bad_${name}`)
  if (typeof record.ai_feedback !== 'string' || record.ai_feedback.length > 4_000) throw new Error(`bad_${name}`)
  return {
    answer: record.answer,
    score: record.score,
    ai_feedback: record.ai_feedback,
  }
}

function validatePartArray(value: unknown, name: string): Array<QuizPartGrade | null> {
  if (!Array.isArray(value) || value.length > 10) throw new Error(`bad_${name}`)
  return value.map(part => (part == null ? null : validatePartGrade(part, name)))
}

function validateQuizAttemptPatch(userId: string, input: unknown): QuizAttemptPatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bad_quiz_attempt')
  const record = input as Record<string, unknown>
  assertMatchingUser(record, userId)

  if (typeof record.topic_id !== 'string' || !isValidTopicId(record.topic_id)) throw new Error('bad_topic_id')
  const attemptedAt = validateDate(record.attempted_at, 'attempted_at')
  const hasQuizField = QUIZ_FIELDS.some(field => hasOwn(record, field))
  const reset = record.reset === true
  if (!reset && !hasQuizField) throw new Error('bad_quiz_attempt')

  const payload: QuizAttemptPatch['payload'] = {}
  if (hasOwn(record, 'mcq_score')) payload.mcq_score = optionalInteger(record.mcq_score, 'mcq_score')
  if (hasOwn(record, 'mcq_total')) payload.mcq_total = optionalInteger(record.mcq_total, 'mcq_total')
  if (hasOwn(record, 'mcq_answers')) payload.mcq_answers = validateMcqAnswers(record.mcq_answers)
  if (hasOwn(record, 'saq_parts')) payload.saq_parts = validatePartArray(record.saq_parts, 'saq_parts')
  if (hasOwn(record, 'reflect')) payload.reflect = validatePartGrade(record.reflect, 'reflect')
  if (hasOwn(record, 'skill_parts')) payload.skill_parts = validatePartArray(record.skill_parts, 'skill_parts')

  if (
    typeof payload.mcq_score === 'number' &&
    typeof payload.mcq_total === 'number' &&
    payload.mcq_score > payload.mcq_total
  ) {
    throw new Error('bad_mcq_score')
  }

  return {
    user_id: record.user_id,
    topic_id: record.topic_id,
    attempted_at: attemptedAt,
    reset,
    payload,
  }
}

function completionFromRow(row: CompletionRow): Completion {
  return {
    user_id: row.user_id,
    resource_id: row.resource_id,
    status: row.status,
    score: row.score ?? undefined,
    score_max: row.score_max ?? undefined,
    completed_at: iso(row.completed_at),
  }
}

function topicUnlockFromRow(row: TopicUnlockRow): TopicUnlockRecord {
  return {
    user_id: row.user_id,
    section_id: row.section_id,
    unlocked_at: iso(row.unlocked_at),
  }
}

function quizAttemptFromRow(row: QuizAttemptRow): QuizAttempt {
  return {
    user_id: row.user_id,
    topic_id: row.topic_id,
    attempted_at: iso(row.attempted_at),
    mcq_score: row.mcq_score ?? undefined,
    mcq_total: row.mcq_total ?? undefined,
    mcq_answers: row.mcq_answers ?? undefined,
    saq_parts: row.saq_parts ?? undefined,
    reflect: row.reflect ?? undefined,
    skill_parts: row.skill_parts ?? undefined,
  }
}

async function runQuery<T extends QueryResultRow>(
  client: PoolClient | null,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  if (client) {
    const result = await client.query<T>(text, values)
    return result.rows
  }
  return query<T>(text, values)
}

export async function listCompletions(userId: string, resourceIds?: string[]): Promise<Completion[]> {
  await ensureSchema()
  const rows = resourceIds?.length
    ? await query<CompletionRow>(
        `SELECT user_id, resource_id, status, score, score_max, completed_at
         FROM completions
         WHERE user_id = $1 AND resource_id = ANY($2::text[])
         ORDER BY completed_at`,
        [userId, resourceIds],
      )
    : await query<CompletionRow>(
        `SELECT user_id, resource_id, status, score, score_max, completed_at
         FROM completions
         WHERE user_id = $1
         ORDER BY completed_at`,
        [userId],
      )
  return rows.map(completionFromRow)
}

export async function saveCompletionForUser(userId: string, input: unknown): Promise<Completion> {
  await ensureSchema()
  return transaction(client => saveCompletionWithClient(client, userId, validateCompletionInput(userId, input)))
}

async function saveCompletionWithClient(
  client: PoolClient | null,
  userId: string,
  record: CompletionInput,
): Promise<Completion> {
  await runQuery(
    client,
    `INSERT INTO completion_events (user_id, resource_id, status, score, score_max, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      record.resource_id,
      record.status,
      record.score ?? null,
      record.score_max ?? null,
      record.completed_at,
    ],
  )

  const rows = await runQuery<CompletionRow>(
    client,
    `INSERT INTO completions (user_id, resource_id, status, score, score_max, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, resource_id) DO UPDATE SET
      status = EXCLUDED.status,
      score = EXCLUDED.score,
      score_max = EXCLUDED.score_max,
      completed_at = EXCLUDED.completed_at,
      updated_at = now()
     WHERE completions.completed_at <= EXCLUDED.completed_at
     RETURNING user_id, resource_id, status, score, score_max, completed_at`,
    [
      userId,
      record.resource_id,
      record.status,
      record.score ?? null,
      record.score_max ?? null,
      record.completed_at,
    ],
  )
  if (rows[0]) return completionFromRow(rows[0])

  const current = await runQuery<CompletionRow>(
    client,
    `SELECT user_id, resource_id, status, score, score_max, completed_at
     FROM completions
     WHERE user_id = $1 AND resource_id = $2`,
    [userId, record.resource_id],
  )
  if (!current[0]) throw new Error('completion_not_saved')
  return completionFromRow(current[0])
}

export async function listTopicUnlocks(userId: string): Promise<TopicUnlockRecord[]> {
  await ensureSchema()
  const rows = await query<TopicUnlockRow>(
    `SELECT user_id, section_id, unlocked_at
     FROM topic_unlocks
     WHERE user_id = $1
     ORDER BY unlocked_at, section_id`,
    [userId],
  )
  return rows.map(topicUnlockFromRow)
}

export async function unlockSectionForUser(userId: string, input: unknown): Promise<TopicUnlockRecord> {
  await ensureSchema()
  return unlockSectionWithClient(null, userId, validateTopicUnlockInput(input))
}

async function unlockSectionWithClient(
  client: PoolClient | null,
  userId: string,
  record: TopicUnlockInput,
): Promise<TopicUnlockRecord> {
  await assertCanUnlockSectionWithClient(client, userId, record.section_id)
  const rows = await runQuery<TopicUnlockRow>(
    client,
    `INSERT INTO topic_unlocks (user_id, section_id, unlocked_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, section_id) DO UPDATE SET
       unlocked_at = LEAST(topic_unlocks.unlocked_at, EXCLUDED.unlocked_at)
     RETURNING user_id, section_id, unlocked_at`,
    [userId, record.section_id, record.unlocked_at],
  )
  return topicUnlockFromRow(rows[0])
}

async function assertCanUnlockSectionWithClient(
  client: PoolClient | null,
  userId: string,
  sectionId: string,
): Promise<void> {
  const existing = await runQuery<{ section_id: string }>(
    client,
    `SELECT section_id
     FROM topic_unlocks
     WHERE user_id = $1 AND section_id = $2
     LIMIT 1`,
    [userId, sectionId],
  )
  if (existing[0]) return

  const prerequisiteSectionId = prerequisiteSectionForUnlock(sectionId)
  if (!prerequisiteSectionId) {
    if (sectionId === '1.1') return
    throw new Error('unlock_not_allowed')
  }

  const requiredResourceIds = requiredResourceIdsForSection(prerequisiteSectionId)
  if (requiredResourceIds.length === 0) {
    const prerequisiteUnlock = await runQuery<{ section_id: string }>(
      client,
      `SELECT section_id
       FROM topic_unlocks
       WHERE user_id = $1 AND section_id = $2
       LIMIT 1`,
      [userId, prerequisiteSectionId],
    )
    if (prerequisiteUnlock[0]) return
    throw new Error('unlock_not_allowed')
  }

  const rows = await runQuery<{ completed_count: string }>(
    client,
    `SELECT count(DISTINCT resource_id)::text AS completed_count
     FROM completions
     WHERE user_id = $1
       AND resource_id = ANY($2::text[])
       AND status <> 'skipped'`,
    [userId, requiredResourceIds],
  )
  if (Number(rows[0]?.completed_count ?? 0) !== requiredResourceIds.length) {
    throw new Error('unlock_not_allowed')
  }
}

export async function getQuizAttempt(userId: string, topicId: string): Promise<QuizAttempt | null> {
  await ensureSchema()
  if (!isValidTopicId(topicId)) throw new Error('bad_topic_id')
  const rows = await query<QuizAttemptRow>(
    `SELECT user_id, topic_id, attempted_at, mcq_score, mcq_total, mcq_answers, saq_parts, reflect, skill_parts
     FROM quiz_attempts
     WHERE user_id = $1 AND topic_id = $2
     LIMIT 1`,
    [userId, topicId],
  )
  return rows[0] ? quizAttemptFromRow(rows[0]) : null
}

export async function saveQuizAttemptForUser(userId: string, input: unknown): Promise<QuizAttempt> {
  await ensureSchema()
  const patch = validateQuizAttemptPatch(userId, input)

  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext($2::text))', [userId, patch.topic_id])
    await client.query(
      `INSERT INTO quiz_attempt_events (user_id, topic_id, attempted_at, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        userId,
        patch.topic_id,
        patch.attempted_at,
        patch.reset ? 'reset' : 'patch',
        JSON.stringify(patch.payload),
      ],
    )

    const currentRows = await client.query<QuizAttemptRow>(
      `SELECT user_id, topic_id, attempted_at, mcq_score, mcq_total, mcq_answers, saq_parts, reflect, skill_parts
       FROM quiz_attempts
       WHERE user_id = $1 AND topic_id = $2
       FOR UPDATE`,
      [userId, patch.topic_id],
    )
    const next = mergeQuizProjection(
      currentRows.rows[0] ? quizAttemptFromRow(currentRows.rows[0]) : null,
      userId,
      patch,
    )

    const rows = await client.query<QuizAttemptRow>(
      `INSERT INTO quiz_attempts
         (user_id, topic_id, attempted_at, mcq_score, mcq_total, mcq_answers, saq_parts, reflect, skill_parts)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
       ON CONFLICT (user_id, topic_id) DO UPDATE SET
         attempted_at = EXCLUDED.attempted_at,
         mcq_score = EXCLUDED.mcq_score,
         mcq_total = EXCLUDED.mcq_total,
         mcq_answers = EXCLUDED.mcq_answers,
         saq_parts = EXCLUDED.saq_parts,
         reflect = EXCLUDED.reflect,
         skill_parts = EXCLUDED.skill_parts,
         updated_at = now()
       RETURNING user_id, topic_id, attempted_at, mcq_score, mcq_total, mcq_answers, saq_parts, reflect, skill_parts`,
      [
        userId,
        patch.topic_id,
        next.attempted_at,
        next.mcq_score ?? null,
        next.mcq_total ?? null,
        next.mcq_answers ? JSON.stringify(next.mcq_answers) : null,
        next.saq_parts ? JSON.stringify(next.saq_parts) : null,
        next.reflect ? JSON.stringify(next.reflect) : null,
        next.skill_parts ? JSON.stringify(next.skill_parts) : null,
      ],
    )
    return quizAttemptFromRow(rows.rows[0])
  })
}

function mergePartProjection(
  current: Array<QuizPartGrade | null> | undefined,
  patch: Array<QuizPartGrade | null> | undefined,
): Array<QuizPartGrade | null> | undefined {
  if (!patch) return current
  const next = [...(current ?? [])]
  patch.forEach((part, index) => {
    if (part) next[index] = part
  })
  return next
}

function mergeQuizProjection(
  current: QuizAttempt | null,
  userId: string,
  patch: QuizAttemptPatch,
): QuizAttempt {
  if (patch.reset) {
    return {
      user_id: userId,
      topic_id: patch.topic_id,
      attempted_at: patch.attempted_at,
    }
  }

  return {
    user_id: userId,
    topic_id: patch.topic_id,
    attempted_at: patch.attempted_at,
    mcq_score: patch.payload.mcq_score ?? current?.mcq_score,
    mcq_total: patch.payload.mcq_total ?? current?.mcq_total,
    mcq_answers: patch.payload.mcq_answers ?? current?.mcq_answers,
    saq_parts: mergePartProjection(current?.saq_parts, patch.payload.saq_parts),
    reflect: patch.payload.reflect ?? current?.reflect,
    skill_parts: mergePartProjection(current?.skill_parts, patch.payload.skill_parts),
  }
}

export async function commitProgressForUser(userId: string, input: unknown): Promise<ProgressCommitResult> {
  await ensureSchema()
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('bad_commit')
  const body = input as { completions?: unknown; unlockSections?: unknown }
  const completionsInput = body.completions === undefined ? [] : body.completions
  const unlockSectionsInput = body.unlockSections === undefined ? [] : body.unlockSections
  if (!Array.isArray(completionsInput) || !Array.isArray(unlockSectionsInput)) throw new Error('bad_commit')

  const completions = completionsInput.map(item => validateCompletionInput(userId, item))
  const unlocks = unlockSectionsInput.map(sectionId => validateTopicUnlockInput({
    section_id: sectionId,
    unlocked_at: new Date().toISOString(),
  }))

  return transaction(async client => {
    const savedCompletions: Completion[] = []
    const savedUnlocks: TopicUnlockRecord[] = []
    for (const completion of completions) {
      savedCompletions.push(await saveCompletionWithClient(client, userId, completion))
    }
    for (const unlock of unlocks) {
      savedUnlocks.push(await unlockSectionWithClient(client, userId, unlock))
    }
    return { completions: savedCompletions, topicUnlocks: savedUnlocks }
  })
}
