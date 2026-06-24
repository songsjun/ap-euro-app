import type { FlowState, TopicSnapshot } from '@/lib/types'

export function computeFlowState(snapshot: TopicSnapshot): FlowState {
  if (!snapshot.isUnlocked) return { phase: 'LOCKED' }

  const isDone = (resourceId: string) => {
    const completion = snapshot.completions.get(resourceId)
    return completion !== undefined && completion.status !== 'skipped'
  }
  const done = snapshot.aResources.filter(r => isDone(r.id))
  const firstIncomplete = snapshot.aResources.find(r => !isDone(r.id))

  if (firstIncomplete) {
    return {
      phase: 'PRESENTING',
      resource: firstIncomplete,
      slot: done.length + 1,
      total: snapshot.aResources.length,
    }
  }

  // All A-layer complete
  if (snapshot.showRemediation && snapshot.bCandidates.length > 0) {
    return {
      phase: 'REMEDIATION',
      resources: snapshot.bCandidates,
      slot: 1,
      total: snapshot.bCandidates.length,
    }
  }

  return { phase: 'COMPLETE' }
}
