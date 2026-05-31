import type { IRepository } from '@/lib/repository/interface'
import { UNIT_TOPIC_COUNTS } from '@/lib/constants'

function nextTopicId(currentId: string, unitTopicCounts: Record<number, number>): string | null {
  const [unitStr, subStr] = currentId.split('.')
  const unit = parseInt(unitStr)
  const sub  = parseInt(subStr)
  const count = unitTopicCounts[unit] ?? 0
  if (sub < count) return `${unit}.${sub + 1}`
  return null  // last topic in unit
}

export async function handleTopicComplete(
  userId: string,
  sectionId: string,       // e.g. "3.5" or "unit-3-review"
  repo: IRepository,
): Promise<void> {
  // unit-N-review completed → unlock next unit's first topic + special phases
  const reviewMatch = sectionId.match(/^unit-(\d+)-review$/)
  if (reviewMatch) {
    const unit = parseInt(reviewMatch[1])
    const nextUnit = unit + 1
    if (nextUnit <= 9) {
      await repo.unlockSection(userId, `${nextUnit}.1`)
    }
    if (unit >= 3) await repo.unlockSection(userId, 'writing-skills')
    if (unit >= 4) await repo.unlockSection(userId, 'cross-unit')
    if (unit === 9) await repo.unlockSection(userId, 'exam-prep')
    return
  }

  // Regular topic "N.M" completed → unlock next topic or unit review
  if (/^\d+\.\d+$/.test(sectionId)) {
    const next = nextTopicId(sectionId, UNIT_TOPIC_COUNTS)
    if (next) {
      await repo.unlockSection(userId, next)
    } else {
      // Last topic in unit → unlock unit review
      const unit = parseInt(sectionId.split('.')[0])
      await repo.unlockSection(userId, `unit-${unit}-review`)
    }
  }
}
