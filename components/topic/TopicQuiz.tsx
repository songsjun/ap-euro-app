'use client'

import { useState, useEffect, useCallback } from 'react'
import type { QuizTopicData, QuizAttempt, QuizAttemptMutation, QuizPartGrade } from '@/lib/types'
import { StorageService } from '@/lib/infra/storage'
import { gradeSubjectiveAnswer } from '@/lib/infra/ai'
import { repo } from '@/lib/repository'

// ── Helpers ───────────────────────────────────────────────────────────────────

function partKey(part: string): keyof { part_a: string; part_b: string; part_c: string } {
  return `part_${part}` as 'part_a' | 'part_b' | 'part_c'
}

function mergePartArray(
  current: Array<QuizPartGrade | null> | undefined,
  patch: Array<QuizPartGrade | null> | undefined,
): Array<QuizPartGrade | null> | undefined {
  if (!patch) return current
  const next = [...(current ?? [])]
  patch.forEach((part, index) => {
    if (part) next[index] = part
  })
  return next
}

function mergeAttempt(current: QuizAttempt | null, patch: QuizAttemptMutation): QuizAttempt {
  if (patch.reset) {
    return {
      user_id: patch.user_id,
      topic_id: patch.topic_id,
      attempted_at: patch.attempted_at,
    }
  }

  return {
    user_id: patch.user_id,
    topic_id: patch.topic_id,
    attempted_at: patch.attempted_at,
    mcq_score: patch.mcq_score ?? current?.mcq_score,
    mcq_total: patch.mcq_total ?? current?.mcq_total,
    mcq_answers: patch.mcq_answers ?? current?.mcq_answers,
    saq_parts: mergePartArray(current?.saq_parts, patch.saq_parts),
    reflect: patch.reflect ?? current?.reflect,
    skill_parts: mergePartArray(current?.skill_parts, patch.skill_parts),
  }
}

// ── MCQ Section ───────────────────────────────────────────────────────────────

function MCQSection({
  quizData,
  savedAnswers,
  savedScore,
  onSubmit,
}: {
  quizData: QuizTopicData
  savedAnswers?: string[]
  savedScore?: number
  onSubmit: (answers: string[], score: number) => Promise<void>
}) {
  const questions = quizData.mcq_questions ?? []
  const correctAnswers = quizData.mcq_answers ?? []
  const [selected, setSelected] = useState<Record<number, string>>(
    savedAnswers
      ? Object.fromEntries(savedAnswers.map((a, i) => [i + 1, a]))
      : {}
  )
  const [submitted, setSubmitted] = useState(!!savedAnswers)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAnswered = questions.length > 0 && questions.every(q => selected[q.num])

  async function handleSubmit() {
    if (!allAnswered || saving) return
    const answers = questions.map(q => selected[q.num] ?? '')
    const score = answers.filter((a, i) => a === correctAnswers[i]).length
    setSaving(true)
    setError(null)
    try {
      await onSubmit(answers, score)
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save answers')
    } finally {
      setSaving(false)
    }
  }

  const stimulus = quizData.mcq_stimulus_text
  const source = quizData.mcq_stimulus_source

  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
        Multiple Choice · {questions.length} questions
      </p>

      {/* Stimulus */}
      {stimulus && (
        <div className="mb-4 border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
          {source && (
            <p className="text-[11px] text-stone-500 dark:text-stone-400 px-3 py-2 bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 font-medium">
              {source}
            </p>
          )}
          <p className="text-xs text-stone-600 dark:text-stone-300 px-3 py-3 leading-relaxed whitespace-pre-wrap italic max-h-48 overflow-y-auto">
            {stimulus}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {questions.map((q, qi) => {
          const correct = correctAnswers[qi]
          const studentAnswer = selected[q.num]
          const isCorrect = submitted ? studentAnswer === correct : undefined

          return (
            <div key={q.num} className={`rounded-lg border p-3 ${
              submitted
                ? isCorrect
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
                  : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                : 'border-stone-200 dark:border-stone-700'
            }`}>
              <p className="text-sm text-stone-800 dark:text-stone-200 mb-2.5 font-medium leading-snug">
                {q.num}. {q.question}
              </p>
              <div className="space-y-1.5">
                {(Object.entries(q.options) as [string, string][]).map(([letter, text]) => {
                  const isSelected = selected[q.num] === letter
                  const isCorrectLetter = submitted && letter === correct
                  const isWrongSelected = submitted && isSelected && letter !== correct

                  return (
                    <button
                      key={letter}
                      onClick={() => { if (!submitted) setSelected(prev => ({ ...prev, [q.num]: letter })) }}
                      disabled={submitted}
                      className={`w-full text-left flex items-start gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                        isCorrectLetter
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-medium'
                          : isWrongSelected
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          : isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        isCorrectLetter
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : isWrongSelected
                          ? 'border-red-400 bg-red-400 text-white'
                          : isSelected
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-stone-300 dark:border-stone-600'
                      }`}>
                        {letter}
                      </span>
                      <span className="leading-snug">{text}</span>
                    </button>
                  )
                })}
              </div>
              {submitted && (
                <p className={`text-xs mt-2 font-medium ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isCorrect ? '✓ Correct' : `✗ Correct answer: ${correct}`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || saving}
          className="mt-4 w-full py-2 rounded-lg text-sm font-medium bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-40 transition-colors">
          {saving ? 'Saving…' : 'Submit Answers'}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {submitted && (
        <div className="mt-3 text-center">
          <span className={`text-sm font-semibold ${
            (savedScore ?? 0) === questions.length ? 'text-emerald-600' :
            (savedScore ?? 0) >= questions.length * 0.67 ? 'text-amber-600' : 'text-red-600'
          }`}>
            Score: {savedScore ?? questions.filter((q, i) => (savedAnswers?.[i] ?? selected[q.num]) === correctAnswers[i]).length} / {questions.length}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Answer Hint Panel ─────────────────────────────────────────────────────────

const ANSWER_HINTS: Record<'saq' | 'reflect' | 'skill', {
  title: string
  color: string
  badge: string
  items: string[]
}> = {
  saq: {
    title: 'SAQ Tips',
    color: 'bg-teal-50/80 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800',
    badge: 'text-teal-700 dark:text-teal-300',
    items: [
      'Answer directly — no introduction or conclusion needed',
      'Structure: claim → specific evidence (names/dates/events) → causal analysis',
      '2–4 complete sentences per part, approximately 50–100 words',
      'Be specific: write "Louis XIV promoted mercantilism" not "he implemented policies"',
      'Key to 1 point: clear claim + on-topic evidence + sound reasoning — all three required',
    ],
  },
  reflect: {
    title: 'Reflection Question Tips',
    color: 'bg-indigo-50/80 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
    badge: 'text-indigo-700 dark:text-indigo-300',
    items: [
      'Connect your answer to the core concepts and historical themes of this Topic',
      'State a clear judgment about the historical impact or significance',
      '3–4 sentences are sufficient — no formal essay structure required',
      'High-scoring approach: explain "why it matters" or compare to another period/region',
    ],
  },
  skill: {
    title: 'Historical Thinking Skill Tips',
    color: 'bg-amber-50/80 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    badge: 'text-amber-700 dark:text-amber-300',
    items: [
      'Contextualization: explain the event\'s place within a broader historical context — 3+ sentences required',
      'Specify a concrete time period, region, or social group; avoid vague generalizations',
      'Choose one reasoning skill: Comparison / Causation / Continuity and Change Over Time (CCOT)',
      'Key to scoring: your context must precede or extend beyond the specific event the question asks about',
    ],
  },
}

function AnswerHint({ type }: { type: 'saq' | 'reflect' | 'skill' }) {
  const [open, setOpen] = useState(false)
  const hint = ANSWER_HINTS[type]

  return (
    <div className={`rounded-md border text-xs ${hint.color} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:brightness-95 transition-all text-left">
        <span className={`font-semibold ${hint.badge}`}>{hint.title}</span>
        <svg className={`w-3.5 h-3.5 ${hint.badge} transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className={`px-3 pb-2.5 space-y-1 border-t ${hint.color.includes('teal') ? 'border-teal-200 dark:border-teal-800' : hint.color.includes('indigo') ? 'border-indigo-200 dark:border-indigo-800' : 'border-amber-200 dark:border-amber-800'}`}>
          {hint.items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 pt-1 leading-relaxed text-stone-600 dark:text-stone-400">
              <span className={`shrink-0 font-bold mt-px ${hint.badge}`}>{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Subjective Part ───────────────────────────────────────────────────────────

function SubjectivePart({
  label,
  stimulusSource,
  stimulusText,
  question,
  modelAnswer,
  type,
  saved,
  onGraded,
}: {
  label: string
  stimulusSource?: string | null
  stimulusText?: string | null
  question: string
  modelAnswer: string
  type: 'saq' | 'reflect' | 'skill'
  saved?: QuizPartGrade
  onGraded: (result: QuizPartGrade) => Promise<void>
}) {
  const [answer, setAnswer] = useState(saved?.answer ?? '')
  const [result, setResult] = useState<QuizPartGrade | null>(saved ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModel, setShowModel] = useState(!!saved)

  async function handleGrade() {
    if (!answer.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const { score, feedback } = await gradeSubjectiveAnswer(question, modelAnswer, answer, type)
      const grade: QuizPartGrade = { answer, score, ai_feedback: feedback }
      await onGraded(grade)
      setResult(grade)
      setShowModel(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI grading or save failed')
    }
    setLoading(false)
  }

  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-700">
        <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase mr-2">{label}</span>
        {result && (
          <span className={`text-xs font-semibold ${result.score === 1 ? 'text-emerald-600' : 'text-red-500'}`}>
            {result.score === 1 ? '✓ 1/1 pt' : '✗ 0/1 pt'}
          </span>
        )}
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Optional stimulus */}
        {stimulusText && (
          <div className="border border-stone-200 dark:border-stone-700 rounded p-2 bg-stone-50/50 dark:bg-stone-800/40">
            {stimulusSource && (
              <p className="text-[10px] text-stone-400 mb-1 font-medium">{stimulusSource}</p>
            )}
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed italic max-h-32 overflow-y-auto">
              {stimulusText}
            </p>
          </div>
        )}

        <p className="text-sm text-stone-800 dark:text-stone-200 leading-snug">{question}</p>

        {!result && <AnswerHint type={type} />}

        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          disabled={!!result}
          placeholder="Enter your answer here…"
          rows={4}
          className="w-full text-sm text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-600 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60 disabled:bg-stone-50 dark:disabled:bg-stone-800 placeholder:text-stone-300 dark:placeholder:text-stone-600"
        />

        {!result && (
          <button
            onClick={handleGrade}
            disabled={!answer.trim() || loading}
            className="w-full py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors">
            {loading ? 'AI grading…' : 'Grade with AI'}
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {result && (
          <div className="space-y-2">
            <div className={`rounded-md px-3 py-2 text-xs ${result.score === 1 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
              {result.ai_feedback}
            </div>
          </div>
        )}

        {showModel && modelAnswer && (
          <div className="border-t border-stone-100 dark:border-stone-700 pt-2">
            <p className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase mb-1.5">Model Answer</p>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-wrap">{modelAnswer}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main TopicQuiz ─────────────────────────────────────────────────────────────

interface Props {
  quizData: QuizTopicData
  topicId: string
}

export function TopicQuiz({ quizData, topicId }: Props) {
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [loadingAttempt, setLoadingAttempt] = useState(true)
  const [redoKey, setRedoKey] = useState(0)
  const [savingAttempt, setSavingAttempt] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load existing attempt
  useEffect(() => {
    const userId = StorageService.userId.get()
    if (!userId) { setLoadingAttempt(false); return }
    repo.getQuizAttempt(userId, topicId)
      .then(a => { setAttempt(a); setLoadingAttempt(false) })
      .catch(() => setLoadingAttempt(false))
  }, [topicId])

  const saveAttempt = useCallback(async (updated: Partial<QuizAttemptMutation>) => {
    const userId = StorageService.userId.get()
    if (!userId) return
    const mutation: QuizAttemptMutation = {
      user_id: userId,
      topic_id: topicId,
      attempted_at: new Date().toISOString(),
      ...updated,
    }
    setSavingAttempt(true)
    setSaveError(null)
    try {
      await repo.saveQuizAttempt(mutation)
      setAttempt(current => mergeAttempt(current, mutation))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save quiz attempt'
      setSaveError(message)
      throw error
    } finally {
      setSavingAttempt(false)
    }
  }, [topicId])

  const handleRedo = useCallback(async () => {
    if (savingAttempt) return
    const userId = StorageService.userId.get()
    if (!userId) return
    const blank: QuizAttemptMutation = {
      user_id: userId,
      topic_id: topicId,
      attempted_at: new Date().toISOString(),
      reset: true,
    }
    setSavingAttempt(true)
    setSaveError(null)
    try {
      await repo.saveQuizAttempt(blank)
      setAttempt(mergeAttempt(null, blank))
      setRedoKey(k => k + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not reset quiz attempt')
    } finally {
      setSavingAttempt(false)
    }
  }, [savingAttempt, topicId])

  if (loadingAttempt) return null

  const isContent = quizData.type === 'content'
  const hasQuestions = isContent
    ? (quizData.mcq_questions?.length ?? 0) > 0 || (quizData.saq_parts?.length ?? 0) > 0
    : (quizData.skill_questions?.length ?? 0) > 0

  if (!hasQuestions) return null

  // Summary badge for completed attempt
  const attemptSummary = (() => {
    if (!attempt) return null
    const parts: string[] = []
    if (attempt.mcq_score !== undefined) parts.push(`MCQ ${attempt.mcq_score}/${attempt.mcq_total}`)
    const saqDone = attempt.saq_parts?.filter(p => p && p.score !== undefined).length ?? 0
    if (saqDone > 0) parts.push(`SAQ ${attempt.saq_parts?.reduce((s, p) => s + (p?.score ?? 0), 0)}/${saqDone}`)
    const skillDone = attempt.skill_parts?.filter(p => p && p.score !== undefined).length ?? 0
    if (skillDone > 0) parts.push(`${attempt.skill_parts?.reduce((s, p) => s + (p?.score ?? 0), 0)}/${skillDone}`)
    return parts.length > 0 ? parts.join(' · ') : null
  })()

  return (
    <div className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2.5 flex-1 text-left hover:opacity-80 transition-opacity">
          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
            {isContent ? '📝 Practice Questions' : '🔍 Skill Practice'}
          </span>
          {attemptSummary && (
            <span className="text-xs text-stone-400 dark:text-stone-500">{attemptSummary}</span>
          )}
          {!attemptSummary && (
            <span className="text-xs text-stone-400 dark:text-stone-500">
              {isContent ? `MCQ · SAQ · Reflection` : `${quizData.skill_questions?.length ?? 0} questions`}
            </span>
          )}
          <svg className={`w-4 h-4 text-stone-400 transition-transform ml-auto ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>
        {attemptSummary && (
          <button
            onClick={handleRedo}
            disabled={savingAttempt}
            className="ml-3 shrink-0 text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 border border-stone-200 dark:border-stone-600 rounded px-2 py-0.5 transition-colors disabled:opacity-40">
            {savingAttempt ? 'Saving…' : 'Redo'}
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-stone-100 dark:border-stone-700 px-4 py-4 space-y-6">
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}

          {/* CONTENT TYPE: MCQ + SAQ + Reflect */}
          {isContent && (
            <>
              {/* MCQ */}
              {(quizData.mcq_questions?.length ?? 0) > 0 && (
                <MCQSection
                  key={`mcq-${redoKey}`}
                  quizData={quizData}
                  savedAnswers={attempt?.mcq_answers}
                  savedScore={attempt?.mcq_score}
                  onSubmit={(answers, score) => saveAttempt({
                    mcq_answers: answers,
                    mcq_score: score,
                    mcq_total: quizData.mcq_questions?.length ?? 3,
                  })}
                />
              )}

              {/* SAQ */}
              {(quizData.saq_parts?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
                    Short Answer
                  </p>
                  <div className="space-y-3">
                    {quizData.saq_parts!.map((part, i) => (
                      <SubjectivePart
                        key={`${redoKey}-${part.part}`}
                        label={`(${part.part})`}
                        stimulusSource={part.stimulus_source}
                        stimulusText={part.stimulus_text}
                        question={part.question}
                        modelAnswer={quizData.saq_model_answers?.[partKey(part.part)] ?? ''}
                        type="saq"
                        saved={attempt?.saq_parts?.[i] ?? undefined}
                        onGraded={grade => {
                          const parts: Array<QuizPartGrade | null> = []
                          parts[i] = grade
                          return saveAttempt({ saq_parts: parts })
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reflect */}
              {quizData.reflect_question && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
                    Reflection
                  </p>
                  <SubjectivePart
                    key={`reflect-${redoKey}`}
                    label="Reflect"
                    question={quizData.reflect_question}
                    modelAnswer={quizData.reflect_model_answer ?? ''}
                    type="reflect"
                    saved={attempt?.reflect}
                    onGraded={grade => saveAttempt({ reflect: grade })}
                  />
                </div>
              )}
            </>
          )}

          {/* SKILL / CONTEXTUALIZING TYPE */}
          {!isContent && (quizData.skill_questions?.length ?? 0) > 0 && (
            <div>
              {quizData.skill_section && (
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
                  {quizData.skill_section}
                </p>
              )}
              {quizData.note && (
                <p className="text-xs text-stone-400 dark:text-stone-500 mb-3 italic">{quizData.note}</p>
              )}
              <div className="space-y-3">
                {quizData.skill_questions!.map((q, i) => (
                  <SubjectivePart
                    key={`${redoKey}-skill-${i}`}
                    label={`Q${i + 1}`}
                    question={q}
                    modelAnswer={quizData.skill_model_answers?.[i] ?? ''}
                    type="skill"
                    saved={attempt?.skill_parts?.[i] ?? undefined}
                    onGraded={grade => {
                      const parts: Array<QuizPartGrade | null> = []
                      parts[i] = grade
                      return saveAttempt({ skill_parts: parts })
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
