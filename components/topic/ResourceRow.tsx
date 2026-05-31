'use client'

import { useState } from 'react'
import type { Resource, Completion } from '@/lib/types'
import { SOURCE_META, ESSAY_PASS_THRESHOLD, ESSAY_SCORE_MAX } from '@/lib/constants'

// Default score_max: essay types use rubric values; others default to 5
function defaultScoreMax(r: Resource): number {
  const essayMax = ESSAY_SCORE_MAX[r.type]
  if (essayMax) return essayMax
  if (r.type === 'practice_mcq') return 10
  return 5
}

function isGradedResource(r: Resource): boolean {
  return ['practice_mcq', 'frq_practice', 'dbq', 'leq', 'saq'].includes(r.type)
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    video_intro: '导读视频', video_topic: '主讲视频', video_unit_review: 'Unit复习',
    video_supplement: '深度视频', video_memorization: '记忆视频',
    reading_textbook: '教材', study_guide: '学习指南', note_guide: '笔记模板',
    practice_mcq: 'MCQ练习', frq_practice: 'FRQ真题', primary_source: '一手史料',
    writing_skill: '写作技能', mcq_strategy: 'MCQ策略', exam_review: '考前复习',
    practice_exam: '模拟考试', review_flashcard: '闪卡', reference: '参考文档',
  }
  return labels[type] ?? type
}

function resolveUrl(r: Resource): string | null {
  if (!r.url) return null
  if (r.url.startsWith('local://')) {
    // AMSCO PDF: open with page fragment
    if (r.url.includes('.pdf') && r.pdf_page) return `/amsco.pdf#page=${r.pdf_page}`
    return null
  }
  return r.url
}

// ── ScorePanel ────────────────────────────────────────────────────────────────

function ScorePanel({ resource, onSubmit, onCancel }: {
  resource: Resource
  onSubmit: (score: number, scoreMax: number) => void
  onCancel: () => void
}) {
  const max = defaultScoreMax(resource)
  const [score, setScore] = useState(0)
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const willPass = score / max >= ESSAY_PASS_THRESHOLD

  return (
    <div className="mx-4 mb-3 ml-10 mt-1">
      <div className="bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-600 p-3 space-y-3">
        <p className="text-xs font-medium text-stone-600 dark:text-stone-400">录入得分</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setScore(s => Math.max(0, s - 1))}
            className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-600 font-bold text-lg flex items-center justify-center hover:bg-stone-100 transition-colors dark:bg-stone-700 dark:border-stone-600 dark:text-stone-300">−</button>
          <div className="flex items-baseline gap-1.5 min-w-[4rem] justify-center">
            <span className="text-2xl font-bold text-stone-800 dark:text-stone-200 tabular-nums">{score}</span>
            <span className="text-sm text-stone-400">/ {max}</span>
          </div>
          <button onClick={() => setScore(s => Math.min(max, s + 1))}
            className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-600 font-bold text-lg flex items-center justify-center hover:bg-stone-100 transition-colors dark:bg-stone-700 dark:border-stone-600 dark:text-stone-300">+</button>
          <div className={`ml-1 text-xs font-medium px-2 py-1 rounded-md ${willPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {pct}%{willPass ? ' ✓' : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSubmit(score, max)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${willPass ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
            {willPass ? '通过' : '未达标'}
          </button>
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ResourceRow ───────────────────────────────────────────────────────────────

export interface ResourceRowProps {
  resource: Resource
  completion: Completion | undefined
  scoringId: string | null
  onCheckDirect: (r: Resource) => void
  onCheckGraded: (r: Resource) => void
  onScoreSubmit: (r: Resource, score: number, scoreMax: number) => void
  onScoreCancel: () => void
}

export function ResourceRow({
  resource, completion, scoringId,
  onCheckDirect, onCheckGraded, onScoreSubmit, onScoreCancel,
}: ResourceRowProps) {
  const [expanded, setExpanded] = useState(false)
  const done   = completion?.status === 'passed'
  const failed = completion?.status === 'failed'
  const isScoring = scoringId === resource.id
  const graded = isGradedResource(resource)
  const srcMeta = SOURCE_META[resource.source] ?? { label: resource.source, color: 'text-stone-500' }
  const resolvedUrl = resolveUrl(resource)

  const scoreDisplay = (done || failed) && completion?.score !== undefined && completion.score_max
    ? `${completion.score}/${completion.score_max}`
    : null

  return (
    <div className={`border-l-[3px] ${done ? 'border-l-emerald-400' : failed ? 'border-l-red-300' : 'border-l-stone-200 dark:border-l-stone-600'} transition-colors`}>
      {/* Main row */}
      <div className={`flex items-start gap-3 px-4 pt-3 pb-2 ${done ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>

        {/* Checkbox */}
        <button
          onClick={() => { if (done) return; if (graded) onCheckGraded(resource); else onCheckDirect(resource) }}
          aria-label={done ? `${resource.title} 已完成` : `标记 ${resource.title} 完成`}
          aria-pressed={done}
          className={`mt-0.5 w-5 h-5 rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-all ${
            done   ? 'bg-emerald-500 border-emerald-500 shadow-sm' :
            failed ? 'bg-red-50 border-red-300 hover:bg-red-100 dark:bg-red-950/30' :
                     'border-stone-300 hover:border-blue-400 hover:bg-blue-50 dark:border-stone-600 dark:hover:bg-blue-900/20'
          }`}
        >
          {done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
          {failed && <span className="text-red-400 text-[10px] leading-none font-bold">✕</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {resolvedUrl ? (
              <a href={resolvedUrl} target="_blank" rel="noopener noreferrer"
                className={`text-sm font-medium leading-snug transition-colors flex-1 ${done ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-800 hover:text-blue-600 dark:text-stone-200 dark:hover:text-blue-400'}`}>
                {resource.title}
              </a>
            ) : (
              <span className={`text-sm font-medium leading-snug flex-1 ${done ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-800 dark:text-stone-200'}`}>
                {resource.title}
              </span>
            )}

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {resource.paid && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                  付费
                </span>
              )}
              <span className="text-[11px] text-stone-400 dark:text-stone-500">{typeLabel(resource.type)}</span>
              {resource.textbook_page && (
                <span className="text-[10px] text-blue-500 dark:text-blue-400">p.{resource.textbook_page}</span>
              )}
              {scoreDisplay && (
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {scoreDisplay}
                </span>
              )}
              {resolvedUrl && (
                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer"
                  className="text-stone-300 dark:text-stone-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  aria-label="新标签页打开">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Source + note row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[11px] font-medium ${srcMeta.color}`}>{srcMeta.label}</span>
            {resource.note && (
              <button onClick={() => setExpanded(e => !e)}
                className="text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
                {expanded ? '收起' : '说明'}
              </button>
            )}
            {resource.paid && resource.paid_product && (
              <span className="text-[11px] text-stone-400 dark:text-stone-500">{resource.paid_product}</span>
            )}
          </div>
        </div>
      </div>

      {/* Score panel */}
      {isScoring && (
        <ScorePanel resource={resource} onSubmit={(s, m) => onScoreSubmit(resource, s, m)} onCancel={onScoreCancel} />
      )}

      {/* Expanded note */}
      {expanded && resource.note && !isScoring && (
        <div className="mx-4 mb-2 ml-10 text-xs text-stone-500 dark:text-stone-400 pl-3 border-l border-stone-100 dark:border-stone-700 pt-1">
          {resource.note}
        </div>
      )}
    </div>
  )
}

// ── TierSection ───────────────────────────────────────────────────────────────

interface TierSectionProps {
  tier: 'A' | 'B' | 'C'
  label: string
  description?: string
  statusText?: string
  resources: Resource[]
  defaultOpen: boolean
  completions: Map<string, Completion>
  scoringId: string | null
  onCheckDirect: (r: Resource) => void
  onCheckGraded: (r: Resource) => void
  onScoreSubmit: (r: Resource, score: number, scoreMax: number) => void
  onScoreCancel: () => void
}

const TIER_STYLE = {
  A: { border: 'border-blue-100 dark:border-blue-900/30', bg: 'bg-blue-50/50 dark:bg-blue-900/10', badge: 'bg-blue-600 text-white', text: 'text-blue-700 dark:text-blue-300' },
  B: { border: 'border-amber-100 dark:border-amber-900/30', bg: 'bg-amber-50/40 dark:bg-amber-900/10', badge: 'bg-amber-500 text-white', text: 'text-amber-700 dark:text-amber-300' },
  C: { border: 'border-teal-100 dark:border-teal-900/30', bg: 'bg-teal-50/40 dark:bg-teal-900/10', badge: 'bg-teal-500 text-white', text: 'text-teal-700 dark:text-teal-300' },
}

export function TierSection({
  tier, label, description, statusText, resources, defaultOpen,
  completions, scoringId, onCheckDirect, onCheckGraded, onScoreSubmit, onScoreCancel,
}: TierSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const s = TIER_STYLE[tier]

  return (
    <div className={`bg-white dark:bg-stone-800 rounded-xl border ${s.border} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`w-full px-4 py-2.5 flex items-center justify-between ${s.bg} hover:brightness-95 transition-all text-left`}>
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${s.badge}`}>{tier}</span>
          <span className={`text-sm font-medium ${s.text}`}>{label}</span>
          {description && <span className="text-xs text-stone-400 dark:text-stone-500">{description}</span>}
        </div>
        <div className="flex items-center gap-2">
          {statusText && <span className="text-xs text-stone-500 dark:text-stone-400">{statusText}</span>}
          <svg className={`w-3.5 h-3.5 text-stone-300 dark:text-stone-600 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-stone-50 dark:divide-stone-700">
          {resources.map(r => (
            <ResourceRow key={r.id} resource={r} completion={completions.get(r.id)}
              scoringId={scoringId} onCheckDirect={onCheckDirect} onCheckGraded={onCheckGraded}
              onScoreSubmit={onScoreSubmit} onScoreCancel={onScoreCancel} />
          ))}
        </div>
      )}
    </div>
  )
}
