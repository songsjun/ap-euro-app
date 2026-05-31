import type { TopicSnapshot, Resource } from '@/lib/types'
import type { IRepository } from '@/lib/repository/interface'

export async function assembleTopicSnapshot(
  userId: string,
  unit: number,
  topicId: string,
  showRemediation: boolean,
  repo: IRepository,
): Promise<TopicSnapshot> {
  const sectionId = topicId || `unit-${unit}-review`

  const [isUnlocked, aResources, bResources] = await Promise.all([
    repo.isSectionUnlocked(userId, sectionId),
    repo.getTopicResources(unit, topicId, 'A'),
    repo.getTopicResources(unit, topicId, 'B'),
  ])

  const allResourceIds = new Set([
    ...aResources.map(r => r.id),
    ...bResources.map(r => r.id),
  ])
  const completionList = await repo.getCompletions(userId, allResourceIds)
  const completions = new Map(completionList.map(c => [c.resource_id, c]))

  // B candidates: not yet completed
  const bCandidates: Resource[] = bResources.filter(r => !completions.has(r.id))

  return { isUnlocked, aResources, completions, bCandidates, showRemediation }
}

export async function assembleUnitReviewSnapshot(
  userId: string,
  unit: number,
  showRemediation: boolean,
  repo: IRepository,
): Promise<TopicSnapshot> {
  const sectionId = `unit-${unit}-review`

  const [isUnlocked, allResources] = await Promise.all([
    repo.isSectionUnlocked(userId, sectionId),
    repo.getUnitEndResources(unit),
  ])

  const aResources = allResources.filter(r => r.layer === 'A')
  const bResources = allResources.filter(r => r.layer === 'B')

  const allIds = new Set(allResources.map(r => r.id))
  const completionList = await repo.getCompletions(userId, allIds)
  const completions = new Map(completionList.map(c => [c.resource_id, c]))

  const bCandidates = bResources.filter(r => !completions.has(r.id))

  return { isUnlocked, aResources, completions, bCandidates, showRemediation }
}
