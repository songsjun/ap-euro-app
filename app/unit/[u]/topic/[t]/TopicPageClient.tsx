'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ensureAppReady } from '@/lib/app/ready'
import { TopicProvider } from '@/lib/app/session-context'
import { TopicListView } from '@/components/topic/TopicListView'
import { TopicSkeleton } from '@/components/TopicSkeleton'

interface Props {
  unit: number
  topicId: string
  unitTitle: string
}

export function TopicPageClient({ unit, topicId, unitTitle }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureAppReady().then(() => setReady(true)).catch(console.error)
  }, [])

  if (!ready) return <TopicSkeleton />

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/unit/${unit}`}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-400 dark:text-stone-500 truncate">Unit {unit} · {unitTitle}</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Topic {topicId}</p>
          </div>
          <Link href="/dashboard" className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
            总览
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <TopicProvider unit={unit} topicId={topicId}>
          <TopicListView unit={unit} topicId={topicId} />
        </TopicProvider>
      </div>
    </div>
  )
}
