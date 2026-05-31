import type { Command, CompletionResult, FlowState } from '@/lib/types'
import type { IRepository } from '@/lib/repository/interface'
import { computeFlowState } from '@/lib/domain/flow'
import { handleTopicComplete } from '@/lib/domain/unlock'
import { assembleTopicSnapshot, assembleUnitReviewSnapshot } from './snapshot'

export interface SessionParams {
  userId: string
  unit: number
  topicId: string       // "" for unit review
  isUnitReview: boolean
  repo: IRepository
}

export class TopicSessionManager {
  private params: SessionParams
  private _showRemediation = false
  private _gen = 0        // load-generation counter to drop stale state

  constructor(params: SessionParams) {
    this.params = params
  }

  async getFlowState(): Promise<FlowState> {
    const snapshot = await this._buildSnapshot()
    return computeFlowState(snapshot)
  }

  async execute(command: Command): Promise<FlowState> {
    const gen = ++this._gen
    const { userId, unit, topicId, isUnitReview, repo } = this.params
    const sectionId = isUnitReview ? `unit-${unit}-review` : topicId

    if (command.type === 'COMPLETE_RESOURCE') {
      const completion = this._buildCompletion(userId, command.resourceId, command.result)
      let unlockTriggered = false

      await repo.transact(async () => {
        await repo.saveCompletion(completion)
        // Check if this completion finishes all A-layer resources
        const snapshot = await this._buildSnapshot()
        const updatedCompletions = new Map(snapshot.completions)
        updatedCompletions.set(command.resourceId, completion)
        const allADone = snapshot.aResources.every(r => updatedCompletions.has(r.id))
        if (allADone) {
          await handleTopicComplete(userId, sectionId, repo)
          unlockTriggered = true
        }
      })

      if (gen !== this._gen) return this.getFlowState()
      return this.getFlowState()
    }

    if (command.type === 'SKIP_RESOURCE') {
      await repo.saveCompletion({
        user_id: userId,
        resource_id: command.resourceId,
        status: 'skipped',
        completed_at: new Date().toISOString(),
      })
      return this.getFlowState()
    }

    if (command.type === 'SHOW_REMEDIATION') {
      this._showRemediation = true
      return this.getFlowState()
    }

    if (command.type === 'REQUEST_FEEDBACK') {
      // No-op in MVP; AI feedback handled separately
      return this.getFlowState()
    }

    return this.getFlowState()
  }

  private async _buildSnapshot() {
    const { userId, unit, topicId, isUnitReview, repo } = this.params
    if (isUnitReview) {
      return assembleUnitReviewSnapshot(userId, unit, this._showRemediation, repo)
    }
    return assembleTopicSnapshot(userId, unit, topicId, this._showRemediation, repo)
  }

  private _buildCompletion(userId: string, resourceId: string, result: CompletionResult) {
    return {
      user_id: userId,
      resource_id: resourceId,
      status: result.status,
      score: result.score,
      score_max: result.score_max,
      completed_at: new Date().toISOString(),
    }
  }
}
