import { StorageService } from '@/lib/infra/storage'
import { seedContentLibrary } from '@/lib/infra/seed'
import { repo } from '@/lib/repository'

let _ready: Promise<void> | null = null

async function bootstrap(): Promise<void> {
  const userId = StorageService.userId.init()
  await seedContentLibrary()
  // Unlock Unit 1 Topic 1.1 on first run
  await repo.unlockSection(userId, '1.1')
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    await navigator.storage.persist()
  }
}

export function ensureAppReady(): Promise<void> {
  if (!_ready) {
    _ready = bootstrap().catch(err => {
      _ready = null
      throw err
    })
  }
  return _ready
}
