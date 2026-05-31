import { UNIT_TOPIC_COUNTS, UNIT_TITLES } from '@/lib/constants'
import { TopicPageClient } from './TopicPageClient'

export function generateStaticParams() {
  const params: { u: string; t: string }[] = []
  for (let unit = 1; unit <= 9; unit++) {
    const count = UNIT_TOPIC_COUNTS[unit] ?? 0
    for (let sub = 1; sub <= count; sub++) {
      params.push({ u: String(unit), t: `${unit}.${sub}` })
    }
  }
  return params
}

export default function TopicPage({ params }: { params: { u: string; t: string } }) {
  const unit = parseInt(params.u)
  const topicId = params.t
  const unitTitle = UNIT_TITLES[unit] ?? `Unit ${unit}`

  return <TopicPageClient unit={unit} topicId={topicId} unitTitle={unitTitle} />
}
