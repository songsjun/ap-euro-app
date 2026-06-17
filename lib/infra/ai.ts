import type { ChatMessage } from '@/lib/types'

type AiProvider = 'codex' | 'gemini'
type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'
type QuestionType = 'saq' | 'reflect' | 'skill'

interface AiGatewayResponse {
  ok: boolean
  text: string
  parsed_json: unknown | null
  error_type: string | null
}

const AI_API_URL = '/api/ai'
const AI_PROVIDER: AiProvider = 'codex'
const AI_MODEL = 'gpt-5.4-mini'

const AI_PARAMS = {
  topicFeedback: { reasoning_effort: 'low' as ReasoningEffort, json_mode: false },
  subjectiveGrading: { reasoning_effort: 'medium' as ReasoningEffort, json_mode: true },
}

function buildSystemPrompt(unit: number, topicId: string, topicTitle: string): string {
  return `You are a knowledgeable AP European History tutor helping a student who just finished studying Topic ${topicId}: "${topicTitle}" (Unit ${unit}).

Your role: provide a concise study feedback in 2-3 short paragraphs (Chinese preferred, max 150 words total):
1. Key takeaway — the single most important concept from this topic
2. Common exam pitfall — what students typically miss or confuse
3. Connection hint — how this topic links to broader AP Euro themes (continuity, change, causation)

Be specific, concrete, and AP-exam focused. No generic advice. No bullet points.`
}

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

async function callAiGateway(
  prompt: string,
  params: { reasoning_effort: ReasoningEffort; json_mode: boolean },
): Promise<AiGatewayResponse> {
  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: AI_PROVIDER,
      model: AI_MODEL,
      reasoning_effort: params.reasoning_effort,
      json_mode: params.json_mode,
      web_search: false,
      prompt,
    }),
  })

  if (!response.ok) throw new Error(`AI gateway unavailable: ${response.status}`)

  const data = (await response.json()) as AiGatewayResponse
  if (!data.ok) throw new Error(`AI gateway unavailable: ${data.error_type ?? 'unknown'}`)
  return data
}

function jsonObjectFromResponse(response: AiGatewayResponse): Record<string, unknown> {
  const parsed = isRecord(response.parsed_json) ? response.parsed_json : parseJsonObject(response.text)
  if (!parsed) throw new Error('AI gateway returned invalid JSON')
  return parsed
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first === -1 || last <= first) return null
    try {
      const parsed: unknown = JSON.parse(text.slice(first, last + 1))
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function scoreValue(value: unknown): number {
  return value === 1 ? 1 : 0
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export async function gradeSubjectiveAnswer(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  type: QuestionType
): Promise<{ score: number; feedback: string }> {
  const prompt = `${GRADE_SYSTEM[type]}

Model answer (reference): ${modelAnswer}

Question: ${question}

Student's answer: ${studentAnswer.slice(0, 3000)}`

  const response = await callAiGateway(prompt, AI_PARAMS.subjectiveGrading)
  const parsed = jsonObjectFromResponse(response)
  return {
    score: scoreValue(parsed.score),
    feedback: stringValue(parsed.feedback),
  }
}

export async function requestTopicFeedback(
  unit: number,
  topicId: string,
  topicTitle: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `我刚刚完成了 Topic ${topicId} "${topicTitle}" 的学习。请给我一个学习总结和备考提示。`,
    },
  ]
  const transcript = messages.map(message => `${message.role}: ${message.content}`).join('\n')
  const prompt = `${buildSystemPrompt(unit, topicId, topicTitle)}

Conversation:
${transcript}

Respond as the tutor.`

  const response = await callAiGateway(prompt, AI_PARAMS.topicFeedback)
  return response.text
}
