import { getDb } from '@/lib/infra/db'
import { CONTENT_VERSION } from '@/lib/constants'
import type { Resource, TopicMeta } from '@/lib/types'

// Source priority for slot_order within same layer
const SOURCE_RANK: Record<string, number> = {
  heimler: 1, amsco: 2, fiveable: 3, marco_learning: 4,
  tom_richey: 5, college_board: 6, albert_io: 7, knowt: 8, num8ers: 9,
}

function slotOrder(r: { layer: string; source: string; id: string }, index: number): number {
  // A before B, within layer sort by SOURCE_RANK then original index
  const layerBase = r.layer === 'A' ? 0 : 1000
  const sourceRank = SOURCE_RANK[r.source] ?? 50
  return layerBase + sourceRank * 10 + index
}

interface CurriculumResource {
  id: string
  title: string
  url: string
  type: string
  source: string
  layer: 'A' | 'B'
  timing: string
  paid: boolean
  paid_product?: string
  note?: string
  unlock_after_unit?: number
  estimated_minutes?: number
}

interface CurriculumTopic {
  id: string
  title: string
  type: 'contextualizing' | 'content' | 'skill_synthesis'
  amsco_chapter: string
  resources: CurriculumResource[]
}

interface CurriculumUnit {
  number: number
  topics: CurriculumTopic[]
  unit_resources: CurriculumResource[]
}

interface Curriculum {
  units: CurriculumUnit[]
  frq_writing_skills: CurriculumResource[]
  cross_unit_practice: CurriculumResource[]
  exam_prep: CurriculumResource[]
}

export async function seedContentLibrary(): Promise<void> {
  const db = getDb()
  const meta = await db.meta.get('content_version')
  if (meta?.value === CONTENT_VERSION) return

  const curriculum = (await import('@/data/curriculum.json')) as unknown as Curriculum

  const resources: Resource[] = []
  const topics: TopicMeta[] = []

  // Topic-level resources
  for (const unit of curriculum.units) {
    unit.topics.forEach((topic, topicIdx) => {
      topics.push({
        id: topic.id,
        unit: unit.number,
        title: topic.title,
        type: topic.type,
        amsco_chapter: topic.amsco_chapter,
        slot_order: topicIdx + 1,
      })

      topic.resources.forEach((r, i) => {
        resources.push({
          ...r,
          layer: r.layer as 'A' | 'B',
          timing: r.timing as Resource['timing'],
          adapter_type: 'external_manual',
          unit: unit.number,
          topic_id: topic.id,
          slot_order: slotOrder(r, i),
        })
      })
    })

    // Unit-end resources
    unit.unit_resources.forEach((r, i) => {
      resources.push({
        ...r,
        layer: r.layer as 'A' | 'B',
        timing: 'unit_end',
        adapter_type: 'external_manual',
        unit: unit.number,
        topic_id: '',
        slot_order: i + 1,
      })
    })
  }

  // Writing skills
  curriculum.frq_writing_skills.forEach((r, i) => {
    resources.push({
      ...r,
      layer: r.layer as 'A' | 'B',
      timing: 'writing_skill',
      adapter_type: 'external_manual',
      unit: 0,
      topic_id: '',
      slot_order: i + 1,
    })
  })

  // Cross-unit practice
  curriculum.cross_unit_practice.forEach((r, i) => {
    resources.push({
      ...r,
      layer: r.layer as 'A' | 'B',
      timing: 'cross_unit',
      adapter_type: 'external_manual',
      unit: 0,
      topic_id: '',
      slot_order: i + 1,
    })
  })

  // Exam prep
  curriculum.exam_prep.forEach((r, i) => {
    resources.push({
      ...r,
      layer: r.layer as 'A' | 'B',
      timing: 'exam_prep',
      adapter_type: 'external_manual',
      unit: 0,
      topic_id: '',
      slot_order: i + 1,
    })
  })

  await db.transaction('rw', db.resources, db.topics, db.meta, async () => {
    await db.resources.clear()
    await db.topics.clear()
    await db.resources.bulkPut(resources)
    await db.topics.bulkPut(topics)
    await db.meta.put({ key: 'content_version', value: CONTENT_VERSION })
  })
}
