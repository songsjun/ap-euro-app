'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ensureAppReady } from '@/lib/app/ready'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import { SOURCE_META, ESSAY_SCORE_MAX, ESSAY_PASS_THRESHOLD } from '@/lib/constants'
import type { Resource, Completion } from '@/lib/types'

const ESSAY_TYPES = ['dbq', 'leq', 'saq', 'frq_practice']

interface ScoreEntry {
  resourceId: string
  score: string
  scoreMax: number
  editing: boolean
}

export function ExamPrepView() {
  const [resources, setResources] = useState<Resource[]>([])
  const [completions, setCompletions] = useState<Map<string, Completion>>(new Map())
  const [scores, setScores] = useState<Map<string, ScoreEntry>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureAppReady().then(async () => {
      const userId = StorageService.userId.get()!
      const [res, allCompletions] = await Promise.all([
        repo.getResourcesByTiming('exam_prep'),
        repo.getAllUserCompletions(userId),
      ])

      const compMap = new Map(allCompletions.map(c => [c.resource_id, c]))
      setCompletions(compMap)

      const scoreMap = new Map<string, ScoreEntry>()
      for (const r of res) {
        if (ESSAY_TYPES.includes(r.type)) {
          const existing = compMap.get(r.id)
          const maxScore = ESSAY_SCORE_MAX[r.type] ?? 5
          scoreMap.set(r.id, {
            resourceId: r.id,
            score: existing?.score != null ? String(existing.score) : '',
            scoreMax: existing?.score_max ?? maxScore,
            editing: false,
          })
        }
      }
      setScores(scoreMap)
      setResources(res.sort((a, b) => a.slot_order - b.slot_order))
      setReady(true)
    }).catch(console.error)
  }, [])

  async function toggleDone(resource: Resource) {
    const userId = StorageService.userId.get()!
    setSaving(resource.id)
    const isDone = completions.get(resource.id)?.status === 'passed'
    const completion: Completion = {
      user_id: userId,
      resource_id: resource.id,
      status: isDone ? 'skipped' : 'passed',
      completed_at: new Date().toISOString(),
    }
    await repo.saveCompletion(completion)
    setCompletions(prev => new Map(prev).set(resource.id, completion))
    setSaving(null)
  }

  async function saveScore(resource: Resource) {
    const userId = StorageService.userId.get()!
    const entry = scores.get(resource.id)
    if (!entry) return
    const scoreNum = parseFloat(entry.score)
    if (isNaN(scoreNum)) return

    setSaving(resource.id)
    const passed = scoreNum / entry.scoreMax >= ESSAY_PASS_THRESHOLD
    const completion: Completion = {
      user_id: userId,
      resource_id: resource.id,
      status: passed ? 'passed' : 'failed',
      score: scoreNum,
      score_max: entry.scoreMax,
      completed_at: new Date().toISOString(),
    }
    await repo.saveCompletion(completion)
    setCompletions(prev => new Map(prev).set(resource.id, completion))
    setScores(prev => {
      const next = new Map(prev)
      next.set(resource.id, { ...entry, editing: false })
      return next
    })
    setSaving(null)
  }

  const aResources = resources.filter(r => r.layer === 'A')
  const bResources = resources.filter(r => r.layer === 'B')

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-400 dark:text-stone-500">Exam Prep</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Past Exams · Comprehensive Review</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {!ready ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 bg-stone-100 dark:bg-stone-800 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <ExamResourceList
              resources={aResources}
              completions={completions}
              scores={scores}
              saving={saving}
              onToggle={toggleDone}
              onScoreChange={(id, val) => setScores(prev => {
                const next = new Map(prev)
                const entry = next.get(id)
                if (entry) next.set(id, { ...entry, score: val })
                return next
              })}
              onScoreEdit={(id) => setScores(prev => {
                const next = new Map(prev)
                const entry = next.get(id)
                if (entry) next.set(id, { ...entry, editing: true })
                return next
              })}
              onScoreSave={saveScore}
            />
            {bResources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2 px-1">
                  Supplemental Resources
                </p>
                <ExamResourceList
                  resources={bResources}
                  completions={completions}
                  scores={scores}
                  saving={saving}
                  onToggle={toggleDone}
                  onScoreChange={(id, val) => setScores(prev => {
                    const next = new Map(prev)
                    const entry = next.get(id)
                    if (entry) next.set(id, { ...entry, score: val })
                    return next
                  })}
                  onScoreEdit={(id) => setScores(prev => {
                    const next = new Map(prev)
                    const entry = next.get(id)
                    if (entry) next.set(id, { ...entry, editing: true })
                    return next
                  })}
                  onScoreSave={saveScore}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ExamResourceList({ resources, completions, scores, saving, onToggle, onScoreChange, onScoreEdit, onScoreSave }: {
  resources: Resource[]
  completions: Map<string, Completion>
  scores: Map<string, ScoreEntry>
  saving: string | null
  onToggle: (r: Resource) => void
  onScoreChange: (id: string, val: string) => void
  onScoreEdit: (id: string) => void
  onScoreSave: (r: Resource) => void
}) {
  return (
    <div className="space-y-2">
      {resources.map(r => {
        const comp = completions.get(r.id)
        const isDone = comp?.status === 'passed'
        const isFailed = comp?.status === 'failed'
        const isEssay = ESSAY_TYPES.includes(r.type)
        const scoreEntry = scores.get(r.id)
        const meta = SOURCE_META[r.source]

        return (
          <div key={r.id}
            className={`px-4 py-3 rounded-xl border transition-all ${
              isDone ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10' :
              isFailed ? 'border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10' :
              'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800'
            }`}>
            <div className="flex items-start gap-3">
              {!isEssay && (
                <button
                  onClick={() => onToggle(r)}
                  disabled={saving === r.id}
                  className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isDone
                      ? 'border-emerald-400 bg-emerald-400 text-white'
                      : 'border-stone-300 dark:border-stone-600 hover:border-emerald-400'
                  }`}>
                  {isDone && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )}
              <div className="flex-1 min-w-0">
                {r.url && !r.url.startsWith('local://') ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className={`text-sm font-medium hover:underline ${isDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-800 dark:text-stone-200'}`}>
                    {r.title}
                  </a>
                ) : (
                  <p className={`text-sm font-medium ${isDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-800 dark:text-stone-200'}`}>
                    {r.title}
                  </p>
                )}
                <p className={`text-xs mt-0.5 ${meta?.color ?? 'text-stone-400'}`}>{meta?.label ?? r.source}</p>
              </div>
              {r.paid && (
                <span className="text-[10px] text-amber-600 dark:text-amber-500 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 shrink-0">
                  Paid
                </span>
              )}
            </div>

            {isEssay && scoreEntry && (
              <div className="mt-3 ml-0 flex items-center gap-2">
                {scoreEntry.editing || scoreEntry.score === '' ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={scoreEntry.scoreMax}
                      step={0.5}
                      value={scoreEntry.score}
                      onChange={e => onScoreChange(r.id, e.target.value)}
                      placeholder="Score"
                      className="w-20 text-sm border border-stone-300 dark:border-stone-600 rounded-lg px-2 py-1 bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="text-xs text-stone-400 dark:text-stone-500">/ {scoreEntry.scoreMax}</span>
                    <button
                      onClick={() => onScoreSave(r)}
                      disabled={saving === r.id || scoreEntry.score === ''}
                      className="text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg px-3 py-1 transition-colors">
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`text-sm font-semibold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {scoreEntry.score} / {scoreEntry.scoreMax}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      ({Math.round(parseFloat(scoreEntry.score) / scoreEntry.scoreMax * 100)}%)
                    </span>
                    <button
                      onClick={() => onScoreEdit(r.id)}
                      className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline ml-1">
                      Edit
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
