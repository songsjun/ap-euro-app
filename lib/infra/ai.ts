import { StorageService } from './storage'
import type { ChatMessage } from '@/lib/types'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 400
const GRADE_MAX_TOKENS = 250

function buildSystemPrompt(unit: number, topicId: string, topicTitle: string): string {
  return `You are a knowledgeable AP European History tutor helping a student who just finished studying Topic ${topicId}: "${topicTitle}" (Unit ${unit}).

Your role: provide a concise study feedback in 2-3 short paragraphs (Chinese preferred, max 150 words total):
1. Key takeaway — the single most important concept from this topic
2. Common exam pitfall — what students typically miss or confuse
3. Connection hint — how this topic links to broader AP Euro themes (continuity, change, causation)

Be specific, concrete, and AP-exam focused. No generic advice. No bullet points.`
}

type QuestionType = 'saq' | 'reflect' | 'skill'

const GRADE_SYSTEM: Record<QuestionType, string> = {
  saq: `You are an AP European History teacher grading a Short Answer Question (SAQ) part.
Each SAQ part is worth 1 point. Award 1 if the response accurately addresses the question with at least one specific historical detail. Award 0 if vague, incorrect, or off-topic.
Respond ONLY in this exact JSON format: {"score": 0 or 1, "feedback": "1-2 sentence explanation in Chinese"}`,

  reflect: `You are an AP European History teacher reviewing a student's essential question reflection.
Award 1 if the response shows understanding of key historical developments with at least one specific example. Award 0 if missing key concepts or significantly off-topic.
Respond ONLY in this exact JSON format: {"score": 0 or 1, "feedback": "1-2 sentence explanation in Chinese"}`,

  skill: `You are an AP European History teacher grading a contextualization or skill question.
Award 1 if the response correctly explains or describes the historical context/analysis with at least one specific detail. Award 0 if missing key concepts, vague, or incorrect.
Respond ONLY in this exact JSON format: {"score": 0 or 1, "feedback": "1-2 sentence explanation in Chinese"}`,
}

export async function gradeSubjectiveAnswer(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  type: QuestionType
): Promise<{ score: number; feedback: string }> {
  const apiKey = StorageService.apiKey.get()
  if (!apiKey) throw new Error('No API key configured')

  const userContent = `Model answer (reference): ${modelAnswer}\n\nQuestion: ${question}\n\nStudent's answer: ${studentAnswer}`

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: GRADE_MAX_TOKENS,
      system: GRADE_SYSTEM[type],
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI grading failed: ${response.status} ${err}`)
  }

  const data = await response.json()
  const text: string = data.content?.[0]?.text ?? '{}'
  try {
    const parsed = JSON.parse(text)
    return { score: parsed.score ?? 0, feedback: parsed.feedback ?? '' }
  } catch {
    return { score: 0, feedback: text.slice(0, 200) }
  }
}

export async function requestTopicFeedback(
  unit: number,
  topicId: string,
  topicTitle: string
): Promise<string> {
  const apiKey = StorageService.apiKey.get()
  if (!apiKey) throw new Error('No API key configured')

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `我刚刚完成了 Topic ${topicId} "${topicTitle}" 的学习。请给我一个学习总结和备考提示。`,
    },
  ]

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(unit, topicId, topicTitle),
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI request failed: ${response.status} ${err}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}
