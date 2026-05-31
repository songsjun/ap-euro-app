'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ensureAppReady } from '@/lib/app/ready'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import { UNIT_TITLES, UNIT_TOPIC_COUNTS } from '@/lib/constants'

interface UnitProgress {
  unit: number
  completed: number
  total: number
  unlocked: boolean
  reviewUnlocked: boolean
}

export function DashboardClient() {
  const [unitProgress, setUnitProgress] = useState<UnitProgress[]>([])
  const [writingUnlocked, setWritingUnlocked] = useState(false)
  const [crossUnitUnlocked, setCrossUnitUnlocked] = useState(false)
  const [examPrepUnlocked, setExamPrepUnlocked] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureAppReady().then(async () => {
      const userId = StorageService.userId.get()!
      const [unlocked, allCompletions, allTopics] = await Promise.all([
        repo.getUnlockedSections(userId),
        repo.getAllUserCompletions(userId),
        repo.getAllTopics(),
      ])

      const unlockedSet = new Set(unlocked)
      setWritingUnlocked(unlockedSet.has('writing-skills'))
      setCrossUnitUnlocked(unlockedSet.has('cross-unit'))
      setExamPrepUnlocked(unlockedSet.has('exam-prep'))

      const completedResourceIds = new Set(
        allCompletions.filter(c => c.status === 'passed').map(c => c.resource_id)
      )

      const progress: UnitProgress[] = []
      for (let unit = 1; unit <= 9; unit++) {
        const unitTopics = allTopics.filter(t => t.unit === unit)
        let completedTopics = 0
        for (const t of unitTopics) {
          const aRes = await repo.getTopicResources(unit, t.id, 'A')
          const allDone = aRes.length > 0 && aRes.every(r => completedResourceIds.has(r.id))
          if (allDone) completedTopics++
        }
        progress.push({
          unit,
          completed: completedTopics,
          total: UNIT_TOPIC_COUNTS[unit] ?? 0,
          unlocked: unlockedSet.has(`${unit}.1`),
          reviewUnlocked: unlockedSet.has(`unit-${unit}-review`),
        })
      }
      setUnitProgress(progress)
      setReady(true)
    }).catch(console.error)
  }, [])

  const totalCompleted = unitProgress.reduce((s, u) => s + u.completed, 0)
  const totalTopics = Object.values(UNIT_TOPIC_COUNTS).reduce((s, n) => s + n, 0)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-stone-900 dark:text-stone-100">AP European History</h1>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              {ready ? `${totalCompleted} / ${totalTopics} topics` : '加载中…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/resources" className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
              资源
            </Link>
            <Link href="/settings" className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
              设置
            </Link>
          </div>
        </div>
        {ready && (
          <div className="max-w-2xl mx-auto px-4 pb-2">
            <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${totalTopics > 0 ? (totalCompleted / totalTopics) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Units grid */}
        <div className="grid grid-cols-1 gap-2">
          {!ready ? (
            Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="h-16 bg-stone-100 dark:bg-stone-800 rounded-xl animate-pulse" />
            ))
          ) : (
            unitProgress.map(({ unit, completed, total, unlocked, reviewUnlocked }) => {
              const pct = total > 0 ? (completed / total) * 100 : 0
              const isDone = completed === total && total > 0
              const isCurrent = unlocked && !isDone
              const href = unlocked ? `/unit/${unit}` : '#'

              return (
                <Link key={unit} href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    !unlocked ? 'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 opacity-50 cursor-not-allowed' :
                    isDone ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10 hover:border-emerald-400' :
                    'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                    isDone ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300' :
                    isCurrent ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500'
                  }`}>
                    {isDone ? '✓' : unit}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      !unlocked ? 'text-stone-400 dark:text-stone-500' :
                      isDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-800 dark:text-stone-200'
                    }`}>
                      {UNIT_TITLES[unit]}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 flex-1 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-400' : 'bg-blue-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-stone-400 dark:text-stone-500 shrink-0">{completed}/{total}</span>
                    </div>
                  </div>
                  {unlocked && (
                    <svg className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </Link>
              )
            })
          )}
        </div>

        {/* Special phases */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'writing-skills', label: '写作技能', icon: '✍️', unlocked: writingUnlocked, desc: 'DBQ · LEQ · SAQ', href: '/writing-skills' },
            { key: 'cross-unit', label: '跨单元练习', icon: '🔀', unlocked: crossUnitUnlocked, desc: 'Unit 4 后解锁', href: '/cross-unit' },
            { key: 'exam-prep', label: '考前冲刺', icon: '🎯', unlocked: examPrepUnlocked, desc: 'Unit 9 后解锁', href: '/exam-prep' },
          ].map(({ key, label, icon, unlocked, desc, href }) => (
            <Link key={key} href={unlocked ? href : '#'}
              className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border transition-all text-center ${
                unlocked
                  ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10 hover:border-indigo-400'
                  : 'border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 opacity-50 cursor-not-allowed'
              }`}>
              <span className="text-xl">{icon}</span>
              <span className={`text-xs font-medium ${unlocked ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-400 dark:text-stone-500'}`}>
                {label}
              </span>
              <span className="text-[10px] text-stone-400 dark:text-stone-500">{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
