import type { Resource, TopicMeta, Completion, TopicUnlock } from '@/lib/types'

export interface IRepository {
  // Resources
  getTopicResources(unit: number, topicId: string, layer: 'A' | 'B'): Promise<Resource[]>
  getUnitEndResources(unit: number): Promise<Resource[]>
  getResourcesByTiming(timing: Resource['timing']): Promise<Resource[]>
  getAllResources(): Promise<Resource[]>

  // Topics
  getTopicMeta(id: string): Promise<TopicMeta | null>
  getUnitTopics(unit: number): Promise<TopicMeta[]>
  getAllTopics(): Promise<TopicMeta[]>

  // Completions
  getCompletions(userId: string, resourceIds: Set<string>): Promise<Completion[]>
  getAllUserCompletions(userId: string): Promise<Completion[]>
  saveCompletion(completion: Completion): Promise<void>

  // Unlocks
  isSectionUnlocked(userId: string, sectionId: string): Promise<boolean>
  unlockSection(userId: string, sectionId: string): Promise<void>
  getUnlockedSections(userId: string): Promise<string[]>

  // Transactions
  transact(fn: () => Promise<void>): Promise<void>
}
