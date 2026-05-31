'use client'

import { useEffect, useState } from 'react'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import { ESSAY_SCORE_MAX, ESSAY_PASS_THRESHOLD } from '@/lib/constants'
import essayMap from '@/data/essay_map.json'
import type { EssayEntry, Completion } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  dbq: 'DBQ',
  leq: 'LEQ',
  saq: 'SAQ',
}

const THEME_LABELS: Record<string, string> = {
  ENV: '环境',
  CUL: '文化',
  GOV: '政治/制度',
  ECO: '经济',
  SOC: '社会',
  INT: '国际',
  PP: '个人/政治权力',
}

export function RelatedEssayCard({ unit, topicId }: { unit: number; topicId: string }) {
  const [completions, setCompletions] = useState<Map<string, Completion>>(new Map())
  const [scores, setScores] = useState<Map<string, { score: string; editing: boolean }>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)

  const essays = (essayMap.essays as EssayEntry[]).filter(e =>
    e.units.includes(unit) || e.topics.includes(topicId)
  )

  useEffect(() => {
    if (essays.length === 0) return
    const userId = StorageService.userId.get()!
    const ids = new Set(essays.map(e => e.id))
    repo.getCompletions(userId, ids).then(comps => {
      const map = new Map(comps.map(c => [c.resource_id, c]))
      setCompletions(map)
      const scoreMap = new Map<string, { score: string; editing: boolean }>()
      for (const e of essays) {
        const comp = map.get(e.id)
        scoreMap.set(e.id, {
          score: comp?.score != null ? String(comp.score) : '',
          editing: false,
        })
      }
      setScores(scoreMap)
    }).catch(console.error)
  }, [unit, topicId])

  async function saveScore(essay: EssayEntry) {
    const userId = StorageService.userId.get()!
    const entry = scores.get(essay.id)
    if (!entry) return
    const scoreNum = parseFloat(entry.score)
    if (isNaN(scoreNum)) return

    setSaving(essay.id)
    const maxScore = essay.score_max ?? ESSAY_SCORE_MAX[essay.type] ?? 5
    const passed = scoreNum / maxScore >= ESSAY_PASS_THRESHOLD
    const completion: Completion = {
      user_id: userId,
      resource_id: essay.id,
      status: passed ? 'passed' : 'failed',
      score: scoreNum,
      score_max: maxScore,
      completed_at: new Date().toISOString(),
    }
    await repo.saveCompletion(completion)
    setCompletions(prev => new Map(prev).set(essay.id, completion))
    setScores(prev => {
      const next = new Map(prev)
      next.set(essay.id, { score: entry.score, editing: false })
      return next
    })
    setSaving(null)
  }

  if (essays.length === 0) return null

  return (
    <div className="mt-4 px-4 py-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-3">
        相关历年题目
      </p>
      <div className="space-y-3">
        {essays.map(essay => {
          const comp = completions.get(essay.id)
          const isDone = comp?.status === 'passed'
          const isFailed = comp?.status === 'failed'
          const scoreEntry = scores.get(essay.id)
          const maxScore = essay.score_max ?? ESSAY_SCORE_MAX[essay.type] ?? 5

          return (
            <div key={essay.id} className={`rounded-lg border px-3 py-2.5 transition-all ${
              isDone ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10' :
              isFailed ? 'border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-900/10' :
              'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800'
            }`}>
              <div className="flex items-start gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  essay.type === 'dbq' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                  essay.type === 'leq' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                }`}>
                  {TYPE_LABELS[essay.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-800 dark:text-stone-200'}`}>
                    {essay.preview}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-stone-400 dark:text-stone-500">{essay.year}</span>
                    {essay.theme && (
                      <>
                        <span className="text-stone-300 dark:text-stone-600">·</span>
                        <span className="text-xs text-stone-400 dark:text-stone-500">{THEME_LABELS[essay.theme] ?? essay.theme}</span>
                      </>
                    )}
                    <span className="text-stone-300 dark:text-stone-600">·</span>
                    <span className="text-xs text-stone-400 dark:text-stone-500">满分 {maxScore}</span>
                  </div>
                </div>
              </div>

              {/* Score input */}
              <div className="mt-2.5 flex items-center gap-2">
                {scoreEntry?.editing || scoreEntry?.score === '' ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={maxScore}
                      step={0.5}
                      value={scoreEntry?.score ?? ''}
                      onChange={e => setScores(prev => {
                        const next = new Map(prev)
                        const entry = next.get(essay.id)
                        if (entry) next.set(essay.id, { ...entry, score: e.target.value })
                        return next
                      })}
                      placeholder="录入得分"
                      className="w-24 text-xs border border-stone-300 dark:border-stone-600 rounded-lg px-2 py-1 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-stone-400 dark:text-stone-500">/ {maxScore}</span>
                    <button
                      onClick={() => saveScore(essay)}
                      disabled={saving === essay.id || !scoreEntry?.score}
                      className="text-xs bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg px-3 py-1 transition-colors">
                      保存
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {scoreEntry?.score} / {maxScore}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      {isDone ? '✓ 通过' : '✗ 未达标'}
                      {' '}({Math.round(parseFloat(scoreEntry?.score ?? '0') / maxScore * 100)}%)
                    </span>
                    <button
                      onClick={() => setScores(prev => {
                        const next = new Map(prev)
                        const entry = next.get(essay.id)
                        if (entry) next.set(essay.id, { ...entry, editing: true })
                        return next
                      })}
                      className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline">
                      修改
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
