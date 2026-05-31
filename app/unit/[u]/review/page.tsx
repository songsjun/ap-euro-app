import { UNIT_TITLES } from '@/lib/constants'
import { UnitReviewClient } from './UnitReviewClient'

export function generateStaticParams() {
  return Array.from({ length: 9 }, (_, i) => ({ u: String(i + 1) }))
}

export default function UnitReviewPage({ params }: { params: { u: string } }) {
  const unit = parseInt(params.u)
  return <UnitReviewClient unit={unit} unitTitle={UNIT_TITLES[unit] ?? `Unit ${unit}`} />
}
