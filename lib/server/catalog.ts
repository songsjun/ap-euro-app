import curriculumData from '@/data/curriculum.json'
import essayMapData from '@/data/essay_map.json'
import questionsData from '@/data/questions.json'

interface CatalogResource {
  id: string
  layer?: string
}

interface CatalogTopic {
  id: string
  resources: CatalogResource[]
}

interface CatalogUnit {
  number: number
  topics: CatalogTopic[]
  unit_resources: CatalogResource[]
}

interface CurriculumCatalog {
  units: CatalogUnit[]
  frq_writing_skills: CatalogResource[]
  cross_unit_practice: CatalogResource[]
  exam_prep: CatalogResource[]
}

interface QuestionTopic {
  topic: string
}

interface QuestionCatalog {
  topics: QuestionTopic[]
}

interface EssayCatalog {
  essays: Array<{ id: string }>
}

interface Catalog {
  resourceIds: Set<string>
  topicIds: Set<string>
  sectionIds: Set<string>
  sectionRequiredResourceIds: Map<string, string[]>
  topicOrderByUnit: Map<number, string[]>
}

let catalog: Catalog | null = null

function addResources(target: Set<string>, resources: CatalogResource[]): void {
  for (const resource of resources) {
    if (resource.id) target.add(resource.id)
  }
}

function requiredResourceIds(resources: CatalogResource[]): string[] {
  return resources.filter(resource => resource.layer === 'A').map(resource => resource.id).filter(Boolean)
}

function buildCatalog(): Catalog {
  const curriculum = curriculumData as CurriculumCatalog
  const questions = questionsData as QuestionCatalog
  const essayMap = essayMapData as EssayCatalog

  const resourceIds = new Set<string>()
  const topicIds = new Set<string>()
  const sectionIds = new Set<string>(['writing-skills', 'cross-unit', 'exam-prep'])
  const sectionRequiredResourceIds = new Map<string, string[]>()
  const topicOrderByUnit = new Map<number, string[]>()

  for (const unit of curriculum.units) {
    sectionIds.add(`unit-${unit.number}-review`)
    addResources(resourceIds, unit.unit_resources)
    sectionRequiredResourceIds.set(`unit-${unit.number}-review`, requiredResourceIds(unit.unit_resources))
    topicOrderByUnit.set(unit.number, unit.topics.map(topic => topic.id))

    for (const topic of unit.topics) {
      topicIds.add(topic.id)
      sectionIds.add(topic.id)
      addResources(resourceIds, topic.resources)
      sectionRequiredResourceIds.set(topic.id, requiredResourceIds(topic.resources))
    }
  }

  addResources(resourceIds, curriculum.frq_writing_skills)
  addResources(resourceIds, curriculum.cross_unit_practice)
  addResources(resourceIds, curriculum.exam_prep)
  sectionRequiredResourceIds.set('writing-skills', requiredResourceIds(curriculum.frq_writing_skills))
  sectionRequiredResourceIds.set('cross-unit', requiredResourceIds(curriculum.cross_unit_practice))
  sectionRequiredResourceIds.set('exam-prep', requiredResourceIds(curriculum.exam_prep))

  for (const essay of essayMap.essays) {
    if (essay.id) resourceIds.add(essay.id)
  }

  for (const topic of questions.topics) {
    if (topic.topic) topicIds.add(topic.topic)
  }

  return { resourceIds, topicIds, sectionIds, sectionRequiredResourceIds, topicOrderByUnit }
}

function getCatalog(): Catalog {
  catalog ??= buildCatalog()
  return catalog
}

export function isValidResourceId(resourceId: string): boolean {
  return getCatalog().resourceIds.has(resourceId)
}

export function isValidSectionId(sectionId: string): boolean {
  return getCatalog().sectionIds.has(sectionId)
}

export function isValidTopicId(topicId: string): boolean {
  return getCatalog().topicIds.has(topicId)
}

export function requiredResourceIdsForSection(sectionId: string): string[] {
  return getCatalog().sectionRequiredResourceIds.get(sectionId) ?? []
}

export function prerequisiteSectionForUnlock(sectionId: string): string | null {
  if (sectionId === '1.1') return null
  if (sectionId === 'writing-skills') return 'unit-3-review'
  if (sectionId === 'cross-unit') return 'unit-4-review'
  if (sectionId === 'exam-prep') return 'unit-9-review'

  const reviewMatch = sectionId.match(/^unit-(\d+)-review$/)
  if (reviewMatch) {
    const unit = Number.parseInt(reviewMatch[1], 10)
    const topics = getCatalog().topicOrderByUnit.get(unit) ?? []
    return topics.at(-1) ?? null
  }

  const topicMatch = sectionId.match(/^(\d+)\.(\d+)$/)
  if (!topicMatch) return null
  const unit = Number.parseInt(topicMatch[1], 10)
  const sub = Number.parseInt(topicMatch[2], 10)
  if (unit === 1 && sub === 1) return null
  if (sub === 1) return `unit-${unit - 1}-review`

  const topics = getCatalog().topicOrderByUnit.get(unit) ?? []
  const index = topics.indexOf(sectionId)
  return index > 0 ? topics[index - 1] : `${unit}.${sub - 1}`
}
