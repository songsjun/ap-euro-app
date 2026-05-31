'use client'

interface CompleteBannerProps {
  topicTitle: string
  onShowRemediation?: () => void
  hasBResources?: boolean
}

export function CompleteBanner({ topicTitle, onShowRemediation, hasBResources }: CompleteBannerProps) {
  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {topicTitle} 完成
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            所有必做内容已完成，下一个 Topic 已解锁
          </p>
        </div>
      </div>

      {hasBResources && onShowRemediation && (
        <button
          onClick={onShowRemediation}
          className="w-full py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors"
        >
          查看补充资源（B 层）
        </button>
      )}
    </div>
  )
}
