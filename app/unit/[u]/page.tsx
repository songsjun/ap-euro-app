import { UNIT_TITLES, UNIT_TOPIC_COUNTS } from '@/lib/constants'
import { UnitOverviewClient } from './UnitOverviewClient'

export function generateStaticParams() {
  return Array.from({ length: 9 }, (_, i) => ({ u: String(i + 1) }))
}

export default async function UnitPage({ params }: { params: Promise<{ u: string }> }) {
  const { u } = await params
  const unit = parseInt(u)
  return (
    <UnitOverviewClient
      unit={unit}
      unitTitle={UNIT_TITLES[unit] ?? `Unit ${unit}`}
      topicCount={UNIT_TOPIC_COUNTS[unit] ?? 0}
    />
  )
}
