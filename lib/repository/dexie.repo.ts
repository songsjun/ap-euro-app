import { getDb } from '@/lib/infra/db'
import type { Resource, TopicMeta, Completion, TopicUnlock } from '@/lib/types'
import type { IRepository } from './interface'

export class DexieRepository implements IRepository {
  async getTopicResources(unit: number, topicId: string, layer: 'A' | 'B' | 'C'): Promise<Resource[]> {
    const db = getDb()
    return db.resources
      .where('[unit+topic_id+layer]')
      .equals([unit, topicId, layer])
      .sortBy('slot_order')
  }

  async getUnitEndResources(unit: number): Promise<Resource[]> {
    const db = getDb()
    return db.resources
      .where({ unit, timing: 'unit_end' })
      .sortBy('slot_order')
  }

  async getResourcesByTiming(timing: Resource['timing']): Promise<Resource[]> {
    const db = getDb()
    return db.resources.where('timing').equals(timing).sortBy('slot_order')
  }

  async getAllResources(): Promise<Resource[]> {
    return getDb().resources.toArray()
  }

  async getTopicMeta(id: string): Promise<TopicMeta | null> {
    return (await getDb().topics.get(id)) ?? null
  }

  async getUnitTopics(unit: number): Promise<TopicMeta[]> {
    const db = getDb()
    return db.topics.where('unit').equals(unit).sortBy('slot_order')
  }

  async getAllTopics(): Promise<TopicMeta[]> {
    return getDb().topics.toArray()
  }

  async getCompletions(userId: string, resourceIds: Set<string>): Promise<Completion[]> {
    const db = getDb()
    const keys = Array.from(resourceIds).map(id => [userId, id])
    const results = await db.completions.bulkGet(keys)
    return results.filter((c): c is Completion => c !== undefined)
  }

  async getAllUserCompletions(userId: string): Promise<Completion[]> {
    return getDb().completions.where('user_id').equals(userId).toArray()
  }

  async saveCompletion(completion: Completion): Promise<void> {
    await getDb().completions.put(completion)
  }

  async isSectionUnlocked(userId: string, sectionId: string): Promise<boolean> {
    const record = await getDb().topic_unlocks.get([userId, sectionId])
    return record !== undefined
  }

  async unlockSection(userId: string, sectionId: string): Promise<void> {
    await getDb().topic_unlocks.put({
      user_id: userId,
      section_id: sectionId,
      unlocked_at: new Date().toISOString(),
    })
  }

  async getUnlockedSections(userId: string): Promise<string[]> {
    const records = await getDb().topic_unlocks.where('user_id').equals(userId).toArray()
    return records.map(r => r.section_id)
  }

  async transact(fn: () => Promise<void>): Promise<void> {
    const db = getDb()
    await db.transaction('rw', db.completions, db.topic_unlocks, fn)
  }
}
