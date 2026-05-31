import { UNIT_TITLES, UNIT_TOPIC_COUNTS } from '@/lib/constants'
import { UnitOverviewClient } from './UnitOverviewClient'

export function generateStaticParams() {
  return Array.from({ length: 9 }, (_, i) => ({ u: String(i + 1) }))
}

export default function UnitPage({ params }: { params: { u: string } }) {
  const unit = parseInt(params.u)
  return (
    <UnitOverviewClient
      unit={unit}
      unitTitle={UNIT_TITLES[unit] ?? `Unit ${unit}`}
      topicCount={UNIT_TOPIC_COUNTS[unit] ?? 0}
    />
  )
}
