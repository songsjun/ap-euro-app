'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { FlowState, Command } from '@/lib/types'
import { TopicSessionManager } from './session'
import { repo } from '@/lib/repository'
import { StorageService } from '@/lib/infra/storage'

interface TopicContextValue {
  flowState: FlowState
  dispatch: (cmd: Command) => void
  isLoading: boolean
}

const TopicContext = createContext<TopicContextValue | null>(null)

export function useTopicContext(): TopicContextValue {
  const ctx = useContext(TopicContext)
  if (!ctx) throw new Error('useTopicContext must be used inside TopicProvider')
  return ctx
}

interface TopicProviderProps {
  unit: number
  topicId: string       // "" for unit review
  isUnitReview?: boolean
  children: React.ReactNode
}

export function TopicProvider({ unit, topicId, isUnitReview = false, children }: TopicProviderProps) {
  const [flowState, setFlowState] = useState<FlowState>({ phase: 'LOCKED' })
  const [isLoading, setIsLoading] = useState(true)
  const managerRef = useRef<TopicSessionManager | null>(null)
  const queueRef = useRef<Command[]>([])
  const processingRef = useRef(false)

  useEffect(() => {
    const userId = StorageService.userId.get() ?? StorageService.userId.init()
    managerRef.current = new TopicSessionManager({ userId, unit, topicId, isUnitReview, repo })

    managerRef.current.getFlowState().then(state => {
      setFlowState(state)
      setIsLoading(false)
    })
  }, [unit, topicId, isUnitReview])

  const processQueue = useCallback(async () => {
    if (processingRef.current || !managerRef.current) return
    processingRef.current = true
    while (queueRef.current.length > 0) {
      const cmd = queueRef.current.shift()!
      const state = await managerRef.current.execute(cmd)
      setFlowState(state)
    }
    processingRef.current = false
  }, [])

  const dispatch = useCallback((cmd: Command) => {
    queueRef.current.push(cmd)
    processQueue()
  }, [processQueue])

  return (
    <TopicContext.Provider value={{ flowState, dispatch, isLoading }}>
      {children}
    </TopicContext.Provider>
  )
}
