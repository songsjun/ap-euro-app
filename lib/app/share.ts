import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'
import type { ExportData } from '@/lib/types'

export async function exportData(): Promise<ExportData> {
  const userId = StorageService.userId.get()
  if (!userId) throw new Error('No user ID')

  const [completions, topicUnlocks] = await Promise.all([
    repo.getAllUserCompletions(userId),
    repo.getUnlockedSections(userId).then(sections =>
      sections.map(s => ({
        user_id: userId,
        section_id: s,
        unlocked_at: new Date().toISOString(),
      }))
    ),
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    completions,
    topicUnlocks,
  }
}

export async function importData(data: ExportData): Promise<void> {
  if (data.version !== 1) throw new Error(`Unsupported export version: ${data.version}`)

  const userId = StorageService.userId.get()
  if (!userId) throw new Error('No user ID')

  await repo.transact(async () => {
    for (const c of data.completions) {
      await repo.saveCompletion({ ...c, user_id: userId })
    }
    for (const u of data.topicUnlocks) {
      await repo.unlockSection(userId, u.section_id)
    }
  })
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
