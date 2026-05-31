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

export default async function TopicPage({ params }: { params: Promise<{ u: string; t: string }> }) {
  const { u, t } = await params
  const unit = parseInt(u)
  const unitTitle = UNIT_TITLES[unit] ?? `Unit ${unit}`

  return <TopicPageClient unit={unit} topicId={t} unitTitle={unitTitle} />
}
