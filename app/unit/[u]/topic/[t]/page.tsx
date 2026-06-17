import { UNIT_TOPIC_COUNTS, UNIT_TITLES } from '@/lib/constants'
import { TopicPageClient } from './TopicPageClient'
import type { QuizTopicData } from '@/lib/types'
import questionsRaw from '@/data/questions.json'
import answersRaw from '@/data/answers.json'

// Build lookup maps at module load (build time only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const questionsMap = new Map<string, any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (questionsRaw as any).topics.map((t: any) => [t.topic, t])
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const answersMap = new Map<string, any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (answersRaw as any).topics.map((t: any) => [t.topic, t])
)

function buildQuizData(topicId: string): QuizTopicData | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = questionsMap.get(topicId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a: any = answersMap.get(topicId)
  if (!q) return null

  // Content topics have mcq/saq fields; contextualizing/skill_synthesis topics have type field + skill_questions
  const isContent = !!q.mcq

  if (isContent) {
    return {
      topicId,
      title: q.title,
      type: 'content',
      mcq_stimulus_source: q.mcq?.stimulus_source,
      mcq_stimulus_text: q.mcq?.stimulus_text,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcq_questions: q.mcq?.questions?.map((qItem: any) => ({
        num: qItem.num,
        question: qItem.question,
        options: qItem.options,
      })),
      mcq_answers: a?.mcq_answers?.map((ans: { answer: string }) => ans.answer),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saq_parts: q.saq?.map((part: any) => ({
        part: part.part,
        stimulus_source: part.stimulus_source ?? null,
        stimulus_text: part.stimulus_text ?? null,
        question: part.question,
      })),
      saq_model_answers: a?.saq_responses ?? {},
      reflect_question: q.reflect?.question,
      reflect_model_answer: a?.reflect_response,
    }
  }

  // contextualizing or skill_synthesis
  return {
    topicId,
    title: q.title,
    type: (q.type ?? 'contextualizing') as 'contextualizing' | 'skill_synthesis',
    skill_section: q.skill_section,
    skill_questions: q.skill_questions,
    skill_model_answers: a?.skill_responses,
    note: q.note,
  }
}

export function generateStaticParams() {
  const params: { u: string; t: string }[] = []
  for (let unit = 1; unit <= 9; unit++) {
    const count = UNIT_TOPIC_COUNTS[unit] ?? 0
    for (let sub = 1; sub <= count; sub++) {
      params.push({ u: String(unit), t: `${unit}.${sub}` })
    }
  }
  return params
}

export default async function TopicPage({ params }: { params: Promise<{ u: string; t: string }> }) {
  const { u, t } = await params
  const unit = parseInt(u)
  const unitTitle = UNIT_TITLES[unit] ?? `Unit ${unit}`
  const quizData = buildQuizData(t)

  return <TopicPageClient unit={unit} topicId={t} unitTitle={unitTitle} quizData={quizData} />
}
