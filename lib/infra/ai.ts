import { StorageService } from './storage'
import type { ChatMessage } from '@/lib/types'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 400

function buildSystemPrompt(unit: number, topicId: string, topicTitle: string): string {
  return `You are a knowledgeable AP European History tutor helping a student who just finished studying Topic ${topicId}: "${topicTitle}" (Unit ${unit}).

Your role: provide a concise study feedback in 2-3 short paragraphs (Chinese preferred, max 150 words total):
1. Key takeaway — the single most important concept from this topic
2. Common exam pitfall — what students typically miss or confuse
3. Connection hint — how this topic links to broader AP Euro themes (continuity, change, causation)

Be specific, concrete, and AP-exam focused. No generic advice. No bullet points.`
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
