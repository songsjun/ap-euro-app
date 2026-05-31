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
  type: string          // 'video_topic' | 'reading_textbook' | 'study_guide' | 'note_guide' | ...
  source: string        // 'heimler' | 'amsco' | 'marco_learning' | 'tom_richey' | ...
  adapter_type: 'external_manual'
  layer: 'A' | 'B'
  timing: 'topic' | 'unit_end' | 'cross_unit' | 'exam_prep' | 'writing_skill'
  unit: number          // 0 = global (cross-unit / exam-prep)
  topic_id: string      // "3.5" for topic resources; "" for unit_end/global
  slot_order: number
  paid: boolean
  paid_product?: string
  note?: string
  unlock_after_unit?: number
  estimated_minutes?: number
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
  sg_pdf?: string
  sg_page?: number
  units: number[]
  topics: string[]
  preview: string
  theme?: string        // AP Euro theme: ENV/CUL/GOV/ECO/SOC/INT/PP
}

// ── Export/Import ──
export interface ExportData {
  version: 1
  exportedAt: string
  userId: string
  completions: Completion[]
  topicUnlocks: TopicUnlock[]
}
