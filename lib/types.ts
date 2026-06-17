// ── FlowState ──
export type FlowState =
  | { phase: 'LOCKED' }
  | { phase: 'PRESENTING'; resource: Resource; slot: number; total: number }
  | { phase: 'REMEDIATION'; resources: Resource[]; slot: number; total: number }
  | { phase: 'COMPLETE' }

// ── Command ──
export type Command =
  | { type: 'COMPLETE_RESOURCE'; resourceId: string; result: CompletionResult }
  | { type: 'SKIP_RESOURCE'; resourceId: string }
  | { type: 'SHOW_REMEDIATION' }
  | { type: 'REQUEST_FEEDBACK' }

// ── TopicSnapshot: input to Flow Controller ──
export interface TopicSnapshot {
  isUnlocked: boolean
  aResources: Resource[]
  completions: Map<string, Completion>
  bCandidates: Resource[]
  showRemediation: boolean
}

// ── Resource ──
export interface Resource {
  id: string
  title: string
  url: string
  type: string          // 'video_topic' | 'video_intro' | 'video_supplement' | 'reading_textbook' | ...
  source: string        // 'heimler' | 'amsco' | 'marco_learning' | 'tom_richey' | ...
  adapter_type: 'external_manual'
  layer: 'A' | 'B' | 'C'
  timing: 'topic' | 'unit_end' | 'cross_unit' | 'exam_prep' | 'writing_skill'
  unit: number          // 0 = global (cross-unit / exam-prep)
  topic_id: string      // "3.5" for topic resources; "" for unit_end/global
  slot_order: number
  paid: boolean
  paid_product?: string
  note?: string
  unlock_after_unit?: number
  estimated_minutes?: number
  pdf_page?: number     // for local PDF resources (AMSCO textbook)
  textbook_page?: number
}

// ── TopicMeta ──
export interface TopicMeta {
  id: string            // "3.5"
  unit: number
  title: string
  type: 'contextualizing' | 'content' | 'skill_synthesis'
  amsco_chapter: string
  slot_order: number    // 1-based position within the unit
}

// ── Completion ──
export interface Completion {
  user_id: string
  resource_id: string
  status: 'passed' | 'failed' | 'skipped'
  score?: number
  score_max?: number
  completed_at: string
}

// ── CompletionResult: from UI → session ──
export interface CompletionResult {
  status: 'passed' | 'failed' | 'skipped'
  score?: number
  score_max?: number
}

// ── TopicUnlock ──
export interface TopicUnlock {
  user_id: string
  section_id: string    // "3.5" | "unit-3-review" | "writing-skills" | "cross-unit" | "exam-prep"
  unlocked_at: string
}

// ── MetaRecord ──
export interface MetaRecord {
  key: string
  value: string
}

// ── AI ──
export interface DailyFeedback {
  strength: string
  note: string
  preview: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Essay system ──
export type EssayType = 'dbq' | 'leq' | 'saq'

export interface EssayEntry {
  id: string
  year: number
  type: EssayType
  score_max: number     // dbq=7, leq=6, saq=3
  pdf: string           // "local://past_exams/ap24-frq-set1.pdf" or URL
  pdf_page: number
  sg_pdf?: string       // local scoring guide PDF path ("local://...")
  sg_page?: number
  sg_url?: string       // external scoring guide URL (College Board)
  units: number[]
  topics: string[]
  preview: string
  theme?: string        // AP Euro theme: ENV/CUL/GOV/ECO/SOC/INT/PP
}

// ── Quiz system ──

export interface MCQQuestion {
  num: number
  question: string
  options: { A: string; B: string; C: string; D: string }
}

export interface SAQPart {
  part: string
  stimulus_source: string | null
  stimulus_text: string | null
  question: string
}

// Serializable quiz data passed from server page → client components
export interface QuizTopicData {
  topicId: string
  title: string
  type: 'contextualizing' | 'content' | 'skill_synthesis'
  // content type
  mcq_stimulus_source?: string
  mcq_stimulus_text?: string
  mcq_questions?: MCQQuestion[]
  mcq_answers?: string[]        // correct answers e.g. ["C", "A", "D"]
  saq_parts?: SAQPart[]
  saq_model_answers?: Record<string, string>   // {"part_a": "...", "part_b": "..."}
  reflect_question?: string
  reflect_model_answer?: string
  // contextualizing / skill_synthesis type
  skill_section?: string
  skill_questions?: string[]
  skill_model_answers?: string[]
  note?: string
}

export interface QuizPartGrade {
  answer: string
  score: number     // 0 or 1
  ai_feedback: string
}

export interface QuizAttempt {
  user_id: string
  topic_id: string
  attempted_at: string
  mcq_score?: number
  mcq_total?: number
  mcq_answers?: string[]       // student's submitted answers
  saq_parts?: Array<QuizPartGrade | null>
  reflect?: QuizPartGrade
  skill_parts?: Array<QuizPartGrade | null>
}

export interface QuizAttemptMutation {
  user_id: string
  topic_id: string
  attempted_at: string
  reset?: boolean
  mcq_score?: number
  mcq_total?: number
  mcq_answers?: string[]
  saq_parts?: Array<QuizPartGrade | null>
  reflect?: QuizPartGrade
  skill_parts?: Array<QuizPartGrade | null>
}

// ── Export/Import ──
export interface ExportData {
  version: 1
  exportedAt: string
  userId: string
  completions: Completion[]
  topicUnlocks: TopicUnlock[]
}
