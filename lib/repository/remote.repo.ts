import type { Completion, QuizAttempt, QuizAttemptMutation } from '@/lib/types'

import { DexieRepository } from './dexie.repo'

interface CompletionListResponse {
  completions: Completion[]
}

interface TopicUnlockListResponse {
  topicUnlocks: Array<{ section_id: string; unlocked_at: string }>
}

interface QuizAttemptResponse {
  quizAttempt: QuizAttempt | null
}

interface PendingTransaction {
  completions: Completion[]
  unlockSections: string[]
}

function csv(values: string[]): string {
  return values.map(encodeURIComponent).join(',')
}

function requestUrl(path: string): string {
  if (/^[a-z][a-z\d+\-.]*:/i.test(path)) return path
  if (typeof window !== 'undefined') return path
  return new URL(path, 'http://localhost').toString()
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(requestUrl(path), {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.location.reload()
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  return await response.json() as T
}

export class RemoteProgressRepository extends DexieRepository {
  private pendingTransaction: PendingTransaction | null = null
  private transactionQueue: Promise<void> = Promise.resolve()

  private overlayPendingCompletions(completions: Completion[], resourceIds?: Set<string>): Completion[] {
    if (!this.pendingTransaction?.completions.length) return completions
    const byResourceId = new Map(completions.map(completion => [completion.resource_id, completion]))

    for (const completion of this.pendingTransaction.completions) {
      if (resourceIds && !resourceIds.has(completion.resource_id)) continue
      const existing = byResourceId.get(completion.resource_id)
      if (!existing || Date.parse(completion.completed_at) >= Date.parse(existing.completed_at)) {
        byResourceId.set(completion.resource_id, completion)
      }
    }

    return Array.from(byResourceId.values())
  }

  private overlayPendingUnlocks(sections: string[]): string[] {
    if (!this.pendingTransaction?.unlockSections.length) return sections
    return Array.from(new Set([...sections, ...this.pendingTransaction.unlockSections]))
  }

  async getCompletions(_userId: string, resourceIds: Set<string>): Promise<Completion[]> {
    if (resourceIds.size === 0) return []
    const data = await requestJson<CompletionListResponse>(
      `/api/progress/completions?resourceIds=${csv(Array.from(resourceIds))}`,
    )
    return this.overlayPendingCompletions(data.completions, resourceIds)
  }

  async getAllUserCompletions(_userId: string): Promise<Completion[]> {
    const data = await requestJson<CompletionListResponse>('/api/progress/completions')
    return this.overlayPendingCompletions(data.completions)
  }

  async saveCompletion(completion: Completion): Promise<void> {
    if (this.pendingTransaction) {
      this.pendingTransaction.completions.push(completion)
      return
    }
    await requestJson('/api/progress/completions', {
      method: 'PUT',
      body: JSON.stringify(completion),
    })
  }

  async isSectionUnlocked(userId: string, sectionId: string): Promise<boolean> {
    const sections = await this.getUnlockedSections(userId)
    return sections.includes(sectionId)
  }

  async unlockSection(_userId: string, sectionId: string): Promise<void> {
    if (this.pendingTransaction) {
      this.pendingTransaction.unlockSections.push(sectionId)
      return
    }
    await requestJson('/api/progress/topic-unlocks', {
      method: 'PUT',
      body: JSON.stringify({ section_id: sectionId, unlocked_at: new Date().toISOString() }),
    })
  }

  async getUnlockedSections(_userId: string): Promise<string[]> {
    const data = await requestJson<TopicUnlockListResponse>('/api/progress/topic-unlocks')
    return this.overlayPendingUnlocks(data.topicUnlocks.map(record => record.section_id))
  }

  async getQuizAttempt(_userId: string, topicId: string): Promise<QuizAttempt | null> {
    const data = await requestJson<QuizAttemptResponse>(`/api/progress/quiz-attempts?topicId=${encodeURIComponent(topicId)}`)
    return data.quizAttempt
  }

  async saveQuizAttempt(attempt: QuizAttemptMutation): Promise<void> {
    await requestJson('/api/progress/quiz-attempts', {
      method: 'PUT',
      body: JSON.stringify(attempt),
    })
  }

  async transact(fn: () => Promise<void>): Promise<void> {
    if (this.pendingTransaction) {
      await this.transactionQueue.catch(() => undefined)
    }

    const previous = this.transactionQueue.catch(() => undefined)
    let release = () => {}
    const lock = new Promise<void>(resolve => { release = resolve })
    this.transactionQueue = previous.then(() => lock)
    await previous

    const pending: PendingTransaction = { completions: [], unlockSections: [] }
    this.pendingTransaction = pending
    try {
      await fn()
      this.pendingTransaction = null
      if (pending.completions.length === 0 && pending.unlockSections.length === 0) return
      await requestJson('/api/progress/commit', {
        method: 'POST',
        body: JSON.stringify(pending),
      })
    } finally {
      this.pendingTransaction = null
      release()
    }
  }
}
