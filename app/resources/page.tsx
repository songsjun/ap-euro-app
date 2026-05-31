import Link from 'next/link'
import curriculumData from '@/data/curriculum.json'
import amscoData from '@/data/amsco_outline.json'
import videoMeta from '@/data/video_meta.json'
import { SOURCE_META } from '@/lib/constants'
import type { Resource } from '@/lib/types'

// ── Type helpers ────────────────────────────────────────────────────────────

interface AmscoNode { name: string; children: AmscoNode[] }
interface CurriculumTopic { id: string; title: string; resources: Resource[] }
interface CurriculumUnit {
  id: string; number: number; title: string
  topics: CurriculumTopic[]
  unit_resources: Resource[]
}
interface Curriculum {
  units: CurriculumUnit[]
  frq_writing_skills?: Resource[]
  cross_unit_practice?: Resource[]
  exam_prep?: Resource[]
}

const curriculum = curriculumData as unknown as Curriculum
const amscoUnits = (amscoData as AmscoNode[]).filter(n => /^UNIT\s+\d+|^Unit\s+\d+/i.test(n.name))
const vm = videoMeta as Record<string, { duration: string | null }>

// ── Utility ─────────────────────────────────────────────────────────────────

function extractTopicId(name: string): string | null {
  const m = name.match(/Topic\s+(\d+\.\d+)/i)
  return m ? m[1] : null
}

function isVideoResource(r: Resource): boolean {
  return r.type.startsWith('video')
}

function resolveResourceUrl(r: Resource): string | null {
  if (!r.url) return null
  if (r.url.startsWith('local://')) {
    if (r.url.includes('.pdf') && r.pdf_page) return `/amsco.pdf#page=${r.pdf_page}`
    return null
  }
  return r.url
}

function duration(resourceId: string): string | null {
  return vm[resourceId]?.duration ?? null
}

const TYPE_LABEL: Record<string, string> = {
  video_intro: '导读视频',
  video_topic: '主讲视频',
  video_supplement: '深度视频',
  video_memorization: '记忆视频',
  video_unit_review: 'Unit 复习',
  reading_textbook: '教材',
  study_guide: '学习指南',
  note_guide: '笔记模板',
  practice_mcq: 'MCQ 练习',
  frq_practice: 'FRQ 练习',
  primary_source: '一手史料',
  writing_skill: '写作技能',
  mcq_strategy: 'MCQ 策略',
  exam_review: '考前复习',
  practice_exam: '模拟考试',
  review_flashcard: '闪卡',
  reference: '参考文档',
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ResourceItem({ r }: { r: Resource }) {
  const meta = SOURCE_META[r.source]
  const isVideo = isVideoResource(r)
  const dur = duration(r.id)
  const resolvedUrl = resolveResourceUrl(r)
  const typeLabel = TYPE_LABEL[r.type] ?? r.type

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-stone-100 dark:border-stone-800 last:border-0">
      {/* Type + duration badge */}
      <div className="flex flex-col items-center gap-1 shrink-0 w-16 pt-0.5">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded w-full text-center ${
          r.type === 'video_intro'
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
            : r.type === 'video_memorization'
            ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400'
            : isVideo
            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
            : r.type === 'reading_textbook'
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            : r.type === 'study_guide'
            ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400'
            : r.type === 'note_guide'
            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
            : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
        }`}>
          {typeLabel}
        </span>
        {isVideo && dur && (
          <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">{dur}</span>
        )}
        {r.type === 'reading_textbook' && r.textbook_page && (
          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-mono">p.{r.textbook_page}</span>
        )}
      </div>

      {/* Title + source */}
      <div className="flex-1 min-w-0">
        {resolvedUrl ? (
          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-stone-800 dark:text-stone-200 hover:underline leading-snug">
            {r.title}
          </a>
        ) : (
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-snug">{r.title}</p>
        )}
        <p className={`text-xs mt-0.5 ${meta?.color ?? 'text-stone-400 dark:text-stone-500'}`}>
          {meta?.label ?? r.source}
        </p>
        {r.note && (
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 italic">{r.note}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {r.paid && (
          <span className="text-[10px] text-amber-600 dark:text-amber-500 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5">
            付费
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          r.layer === 'A'
            ? 'border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400'
            : r.layer === 'C'
            ? 'border-teal-200 text-teal-600 dark:border-teal-800 dark:text-teal-400'
            : 'border-stone-200 text-stone-400 dark:border-stone-700'
        }`}>
          {r.layer} 层
        </span>
      </div>
    </div>
  )
}

function SectionBlock({ title, resources }: { title: string; resources: Resource[] }) {
  if (resources.length === 0) return null
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-1">{title}</p>
      {resources.map(r => <ResourceItem key={r.id} r={r} />)}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ResourceGuidePage() {
  // Build topic resource map: topic_id → resources
  const topicResourceMap = new Map<string, Resource[]>()
  const unitResourceMap = new Map<number, Resource[]>()

  for (const cu of curriculum.units) {
    unitResourceMap.set(cu.number, cu.unit_resources ?? [])
    for (const ct of cu.topics) {
      topicResourceMap.set(ct.id, ct.resources ?? [])
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">资源指南</p>
            <p className="text-xs text-stone-400 dark:text-stone-500">AP Euro · 按 AMSCO 教材结构排列</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-10">

        {amscoUnits.map((amscoUnit, unitIdx) => {
          const unitNum = unitIdx + 1
          const currUnit = curriculum.units.find(u => u.number === unitNum)
          if (!currUnit) return null

          const amscoTopics = amscoUnit.children
          const unitReviewNode = amscoTopics.find(ch => /review/i.test(ch.name))
          const topicNodes = amscoTopics.filter(ch => !(/review/i.test(ch.name)))

          return (
            <section key={unitNum}>
              {/* Unit header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 flex items-center justify-center text-sm font-bold shrink-0">
                  {unitNum}
                </div>
                <div>
                  <p className="text-xs text-stone-400 dark:text-stone-500">Unit {unitNum}</p>
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">{currUnit.title}</h2>
                </div>
              </div>

              {/* Topics */}
              <div className="space-y-6 ml-1">
                {topicNodes.map((topicNode) => {
                  const topicId = extractTopicId(topicNode.name)
                  const resources = topicId ? (topicResourceMap.get(topicId) ?? []) : []

                  // Filter out "Essential Question" and "Topic Practice Questions" sub-sections for display
                  const contentSubs = topicNode.children.filter(ch =>
                    !ch.name.startsWith('Essential Question') &&
                    !ch.name.startsWith('Analyze the Context') &&
                    !ch.name.includes('Practice Question')
                  )

                  const aRes = resources.filter(r => r.layer === 'A')
                  const bRes = resources.filter(r => r.layer === 'B')
                  const cRes = resources.filter(r => r.layer === 'C')

                  return (
                    <div key={topicNode.name} className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
                      {/* Topic title */}
                      <div className="px-4 py-3 bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-700">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                              {topicNode.name.replace(/^Topic\s+/i, '')}
                            </p>
                            {contentSubs.length > 0 && (
                              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                                {contentSubs.map(s => s.name).join(' · ')}
                              </p>
                            )}
                          </div>
                          {topicId && (
                            <Link href={`/unit/${unitNum}/topic/${topicId}`}
                              className="shrink-0 text-xs text-blue-500 hover:text-blue-700 border border-blue-200 dark:border-blue-800 rounded px-2 py-0.5 transition-colors">
                              学习 →
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Resources */}
                      <div className="px-4 py-2">
                        {resources.length === 0 ? (
                          <p className="text-xs text-stone-400 dark:text-stone-500 py-2">暂无专项资源（参考单元综合资料）</p>
                        ) : (
                          <>
                            <SectionBlock title="必做资源 (A 层)" resources={aRes} />
                            <SectionBlock title="补充资源 (B 层)" resources={bRes} />
                            <SectionBlock title="趣味记忆 (C 层)" resources={cRes} />
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Unit Review */}
                {(() => {
                  const reviewRes = unitResourceMap.get(unitNum) ?? []
                  if (reviewRes.length === 0) return null
                  const aRes = reviewRes.filter(r => r.layer === 'A')
                  const bRes = reviewRes.filter(r => r.layer === 'B')
                  const cRes = reviewRes.filter(r => r.layer === 'C')
                  const label = unitReviewNode?.name ?? `Unit ${unitNum} Review`
                  return (
                    <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-indigo-50/60 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{label}</p>
                        <Link href={`/unit/${unitNum}/review`}
                          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-0.5 transition-colors">
                          复习 →
                        </Link>
                      </div>
                      <div className="px-4 py-2">
                        <SectionBlock title="必做资源 (A 层)" resources={aRes} />
                        <SectionBlock title="补充资源 (B 层)" resources={bRes} />
                        <SectionBlock title="趣味记忆 (C 层)" resources={cRes} />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </section>
          )
        })}

        {/* Special phases */}
        {[
          { key: 'frq_writing_skills', label: '写作技能 (DBQ · LEQ · SAQ)', href: '/writing-skills' },
          { key: 'cross_unit_practice', label: '跨单元练习', href: '/cross-unit' },
          { key: 'exam_prep', label: '考前冲刺', href: '/exam-prep' },
        ].map(({ key, label, href }) => {
          const resources = (curriculum as unknown as Record<string, Resource[]>)[key] ?? []
          if (resources.length === 0) return null
          const aRes = resources.filter(r => r.layer === 'A')
          const bRes = resources.filter(r => r.layer === 'B')
          const cRes = resources.filter(r => r.layer === 'C')
          return (
            <section key={key}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center text-sm shrink-0">✦</div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">{label}</h2>
                <Link href={href} className="ml-auto text-xs text-purple-500 hover:text-purple-700 border border-purple-200 dark:border-purple-800 rounded px-2 py-0.5">
                  进入 →
                </Link>
              </div>
              <div className="border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2">
                  <SectionBlock title="必做资源 (A 层)" resources={aRes} />
                  <SectionBlock title="补充资源 (B 层)" resources={bRes} />
                  <SectionBlock title="趣味记忆 (C 层)" resources={cRes} />
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
