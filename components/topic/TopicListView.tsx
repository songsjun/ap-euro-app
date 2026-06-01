'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Resource, Completion, CompletionResult, TopicMeta } from '@/lib/types'
import { useTopicContext } from '@/lib/app/session-context'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import { TierSection } from './ResourceRow'
import { CompleteBanner } from './CompleteBanner'
import { RelatedEssayCard } from './RelatedEssayCard'
import { TopicQuiz } from './TopicQuiz'
import { TopicSkeleton } from '@/components/TopicSkeleton'
import { StorageService as _StorageService } from '@/lib/infra/storage'
import { requestTopicFeedback } from '@/lib/infra/ai'
import type { QuizTopicData } from '@/lib/types'

interface TopicListViewProps {
  unit: number
  topicId: string       // "" for unit review
  isUnitReview?: boolean
  quizData?: QuizTopicData | null
}

export function TopicListView({ unit, topicId, isUnitReview = false, quizData }: TopicListViewProps) {
  const { flowState, dispatch, isLoading } = useTopicContext()
  const [aResources, setAResources] = useState<Resource[]>([])
  const [bResources, setBResources] = useState<Resource[]>([])
  const [cResources, setCResources] = useState<Resource[]>([])
  const [completions, setCompletions] = useState<Map<string, Completion>>(new Map())
  const [topicMeta, setTopicMeta] = useState<TopicMeta | null>(null)
  const [resourcesLoading, setResourcesLoading] = useState(true)
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const hasApiKey = typeof window !== 'undefined' && !!_StorageService.apiKey.get()

  // Load resources
  const loadResources = useCallback(async () => {
    const userId = StorageService.userId.get()
    if (!userId) return

    let a: Resource[], b: Resource[], c: Resource[]
    if (isUnitReview) {
      const all = await repo.getUnitEndResources(unit)
      a = all.filter(r => r.layer === 'A')
      b = all.filter(r => r.layer === 'B')
      c = all.filter(r => r.layer === 'C')
    } else {
      ;[a, b, c] = await Promise.all([
        repo.getTopicResources(unit, topicId, 'A'),
        repo.getTopicResources(unit, topicId, 'B'),
        repo.getTopicResources(unit, topicId, 'C'),
      ])
    }

    const allIds = new Set([...a, ...b, ...c].map(r => r.id))
    const completionList = await repo.getCompletions(userId, allIds)
    const completionMap = new Map(completionList.map(c => [c.resource_id, c]))

    setAResources(a)
    setBResources(b)
    setCResources(c)
    setCompletions(completionMap)
    setResourcesLoading(false)

    if (!isUnitReview && topicId) {
      const meta = await repo.getTopicMeta(topicId)
      setTopicMeta(meta)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, topicId, isUnitReview])

  useEffect(() => { loadResources() }, [loadResources])

  // Re-load completions after each dispatch to stay in sync
  const refreshCompletions = useCallback(async () => {
    const userId = StorageService.userId.get()
    if (!userId) return
    const allIds = new Set([...aResources, ...bResources, ...cResources].map(r => r.id))
    if (allIds.size === 0) return
    const list = await repo.getCompletions(userId, allIds)
    setCompletions(new Map(list.map(c => [c.resource_id, c])))
  }, [aResources, bResources])

  // Refresh after flow state changes (completions updated)
  useEffect(() => { refreshCompletions() }, [flowState, refreshCompletions])

  const handleCheckDirect = useCallback((r: Resource) => {
    dispatch({ type: 'COMPLETE_RESOURCE', resourceId: r.id, result: { status: 'passed' } })
  }, [dispatch])

  const handleCheckGraded = useCallback((r: Resource) => { setScoringId(r.id) }, [])

  const handleScoreSubmit = useCallback((r: Resource, score: number, scoreMax: number) => {
    const result: CompletionResult = {
      status: score / scoreMax >= 0.6 ? 'passed' : 'failed',
      score,
      score_max: scoreMax,
    }
    dispatch({ type: 'COMPLETE_RESOURCE', resourceId: r.id, result })
    setScoringId(null)
  }, [dispatch])

  const handleScoreCancel = useCallback(() => setScoringId(null), [])

  const handleAiFeedback = useCallback(async () => {
    if (!topicMeta || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    try {
      const text = await requestTopicFeedback(unit, topicId, topicMeta.title)
      setAiFeedback(text)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI 请求失败')
    }
    setAiLoading(false)
  }, [unit, topicId, topicMeta, aiLoading])

  const rowProps = {
    completions,
    scoringId,
    onCheckDirect: handleCheckDirect,
    onCheckGraded: handleCheckGraded,
    onScoreSubmit: handleScoreSubmit,
    onScoreCancel: handleScoreCancel,
  }

  const title = isUnitReview
    ? `Unit ${unit} Review`
    : topicMeta ? `${topicId} ${topicMeta.title}` : topicId

  if (isLoading || resourcesLoading) return <TopicSkeleton />

  if (flowState.phase === 'LOCKED') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <p className="text-stone-500 dark:text-stone-400 text-sm">完成前一个 Topic 后解锁</p>
      </div>
    )
  }

  const aStatus = (() => {
    const done = aResources.filter(r => completions.has(r.id)).length
    return `${done}/${aResources.length} 完成`
  })()
  const isComplete = flowState.phase === 'COMPLETE'
  const bCandidates = bResources.filter(r => !completions.has(r.id))

  return (
    <div className="space-y-3">
      {isComplete && (
        <CompleteBanner
          topicTitle={title}
          hasBResources={bCandidates.length > 0}
          onShowRemediation={undefined}
        />
      )}

      {aResources.length > 0 && (
        <TierSection
          tier="A"
          label="必做"
          description="完成全部以解锁下一 Topic"
          statusText={aStatus}
          resources={aResources}
          defaultOpen={true}
          {...rowProps}
        />
      )}

      {bResources.length > 0 && (
        <TierSection
          tier="B"
          label="补充资源"
          description="深化理解"
          resources={bResources}
          defaultOpen={false}
          {...rowProps}
        />
      )}

      {cResources.length > 0 && (
        <TierSection
          tier="C"
          label="趣味记忆"
          description="扩展与辅助记忆"
          resources={cResources}
          defaultOpen={false}
          {...rowProps}
        />
      )}

      {!isUnitReview && topicId && quizData && (
        <TopicQuiz quizData={quizData} topicId={topicId} />
      )}

      {!isUnitReview && topicId && (
        <>
          {hasApiKey && !aiFeedback && isComplete && (
            <button
              onClick={handleAiFeedback}
              disabled={aiLoading}
              className="w-full py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-60">
              {aiLoading ? 'AI 分析中…' : '✨ 获取 AI 学习反馈'}
            </button>
          )}
          {aiError && (
            <p className="text-xs text-red-500 dark:text-red-400 px-1">{aiError}</p>
          )}
          {aiFeedback && (
            <div className="px-4 py-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">AI 学习反馈</p>
              <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">{aiFeedback}</p>
            </div>
          )}
          <RelatedEssayCard unit={unit} topicId={topicId} />
        </>
      )}
    </div>
  )
}
