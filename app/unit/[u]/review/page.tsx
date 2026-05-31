import { UNIT_TITLES } from '@/lib/constants'
import { UnitReviewClient } from './UnitReviewClient'

export function generateStaticParams() {
  return Array.from({ length: 9 }, (_, i) => ({ u: String(i + 1) }))
}

export default async function UnitReviewPage({ params }: { params: Promise<{ u: string }> }) {
  const { u } = await params
  const unit = parseInt(u)
  return <UnitReviewClient unit={unit} unitTitle={UNIT_TITLES[unit] ?? `Unit ${unit}`} />
}
