'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ensureAppReady } from '@/lib/app/ready'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import { SOURCE_META } from '@/lib/constants'
import type { Resource, Completion } from '@/lib/types'

interface GroupedResources {
  unlockAfterUnit: number
  resources: Resource[]
}

export function WritingSkillsView() {
  const [groups, setGroups] = useState<GroupedResources[]>([])
  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureAppReady().then(async () => {
      const userId = StorageService.userId.get()!
      const [resources, allCompletions] = await Promise.all([
        repo.getResourcesByTiming('writing_skill'),
        repo.getAllUserCompletions(userId),
      ])

      const passedIds = new Set(
        allCompletions.filter(c => c.status === 'passed').map(c => c.resource_id)
      )
      setCompletions(passedIds)

      // Group by unlock_after_unit
      const map = new Map<number, Resource[]>()
      for (const r of resources) {
        const key = r.unlock_after_unit ?? 0
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(r)
      }
      const sorted = Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([unlockAfterUnit, res]) => ({
          unlockAfterUnit,
          resources: res.sort((a, b) => a.slot_order - b.slot_order),
        }))
      setGroups(sorted)
      setReady(true)
    }).catch(console.error)
  }, [])

  async function toggleDone(resource: Resource) {
    const userId = StorageService.userId.get()!
    setSaving(resource.id)
    const isDone = completions.has(resource.id)
    const completion: Completion = {
      user_id: userId,
      resource_id: resource.id,
      status: isDone ? 'skipped' : 'passed',
      completed_at: new Date().toISOString(),
    }
    await repo.saveCompletion(completion)
    setCompletions(prev => {
      const next = new Set(prev)
      if (isDone) next.delete(resource.id)
      else next.add(resource.id)
      return next
    })
    setSaving(null)
  }

  const totalDone = completions.size
  const totalCount = groups.reduce((s, g) => s + g.resources.length, 0)

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
            <p className="text-xs text-stone-400 dark:text-stone-500">Writing Skills</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">DBQ · LEQ · SAQ</p>
          </div>
          {ready && (
            <span className="text-xs text-stone-400 dark:text-stone-500">{totalDone}/{totalCount}</span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {!ready ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-16 bg-stone-100 dark:bg-stone-800 rounded-xl" />
            ))}
          </div>
        ) : groups.map(({ unlockAfterUnit, resources }) => (
          <div key={unlockAfterUnit}>
            <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2 px-1">
              Unlocks after Unit {unlockAfterUnit}
            </p>
            <div className="space-y-2">
              {resources.map(r => {
                const isDone = completions.has(r.id)
                const meta = SOURCE_META[r.source]
                return (
                  <div key={r.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      isDone
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800'
                    }`}>
                    <button
                      onClick={() => toggleDone(r)}
                      disabled={saving === r.id}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
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
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
