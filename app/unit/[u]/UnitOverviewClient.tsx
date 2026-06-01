'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ensureAppReady } from '@/lib/app/ready'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import type { TopicMeta } from '@/lib/types'

export function UnitOverviewClient({ unit, unitTitle, topicCount }: {
  unit: number; unitTitle: string; topicCount: number
}) {
  const [topics, setTopics] = useState<TopicMeta[]>([])
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(new Set())
  const [reviewUnlocked, setReviewUnlocked] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureAppReady().then(async () => {
      const userId = StorageService.userId.get()!
      const [topicList, unlocked, allCompletions] = await Promise.all([
        repo.getUnitTopics(unit),
        repo.getUnlockedSections(userId),
        repo.getAllUserCompletions(userId),
      ])

      const unlockedSet = new Set(unlocked)
      setTopics(topicList)
      setUnlockedIds(unlockedSet)
      setReviewUnlocked(unlockedSet.has(`unit-${unit}-review`))

      // A topic is "completed" if all its A-layer resources are done
      const completedIds: Set<string> = new Set()
      for (const t of topicList) {
        const aRes = await repo.getTopicResources(unit, t.id, 'A')
        const aIds = new Set(aRes.map(r => r.id))
        const doneIds = new Set(allCompletions.filter(c => aIds.has(c.resource_id) && c.status === 'passed').map(c => c.resource_id))
        if (aIds.size > 0 && aIds.size === doneIds.size) completedIds.add(t.id)
      }
      setCompletedTopicIds(completedIds)
      setReady(true)
    }).catch(console.error)
  }, [unit])

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex-1">
            <p className="text-xs text-stone-400">Unit {unit}</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate">{unitTitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {!ready ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: topicCount }, (_, i) => (
              <div key={i} className="h-14 bg-stone-100 dark:bg-stone-800 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {topics.map(t => {
              const isUnlocked = unlockedIds.has(t.id)
              const isDone = completedTopicIds.has(t.id)
              return (
                <Link key={t.id} href={isUnlocked ? `/unit/${unit}/topic/${t.id}` : '#'}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    isDone ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10' :
                    isUnlocked ? 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-blue-300 dark:hover:border-blue-700' :
                    'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 opacity-60 cursor-not-allowed'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300' :
                    isUnlocked ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
                  }`}>
                    {isDone ? '✓' : t.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDone ? 'text-emerald-700 dark:text-emerald-300' : isUnlocked ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400 dark:text-stone-500'}`}>
                      {t.title}
                    </p>
                    {(t.type === 'contextualizing' || t.type === 'skill_synthesis') && (
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                        {t.type === 'contextualizing' ? 'Contextualization' : 'Synthesis'}
                      </p>
                    )}
                  </div>
                  {isUnlocked && !isDone && (
                    <svg className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </Link>
              )
            })}

            {/* Unit Review */}
            <Link href={reviewUnlocked ? `/unit/${unit}/review` : '#'}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all mt-3 ${
                reviewUnlocked
                  ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10 hover:border-indigo-400'
                  : 'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 opacity-50 cursor-not-allowed'
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                reviewUnlocked ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800/40 dark:text-indigo-300' : 'bg-stone-100 text-stone-400 dark:bg-stone-800'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${reviewUnlocked ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-400 dark:text-stone-500'}`}>
                  Unit {unit} Review
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500">Review videos + unit practice</p>
              </div>
              {reviewUnlocked && (
                <svg className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
