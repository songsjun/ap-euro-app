import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Resource, TopicMeta, Completion, TopicUnlock, MetaRecord, QuizAttempt } from '@/lib/types'

export interface AppDB extends Dexie {
  resources:     EntityTable<Resource, 'id'>
  topics:        EntityTable<TopicMeta, 'id'>
  completions:   Table<Completion>
  topic_unlocks: Table<TopicUnlock>
  meta:          EntityTable<MetaRecord, 'key'>
  quiz_attempts: Table<QuizAttempt>
}

let _db: AppDB | null = null

export function getDb(): AppDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in browser')
  }
  if (!_db) {
    _db = new Dexie('EuroLearningDB') as AppDB
    _db.version(1).stores({
      resources:     'id, unit, topic_id, layer, timing, [unit+topic_id], [unit+topic_id+layer]',
      topics:        'id, unit',
      completions:   '[user_id+resource_id], user_id',
      topic_unlocks: '[user_id+section_id], user_id',
      meta:          'key',
    })
    _db.version(2).stores({
      quiz_attempts: '[user_id+topic_id], user_id',
    })
  }
  return _db
}
