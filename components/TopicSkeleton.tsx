export function TopicSkeleton() {
  return (
    <div className="animate-pulse space-y-4 px-4 pt-4">
      <div className="h-6 bg-stone-200 dark:bg-stone-700 rounded w-1/3" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-stone-100 dark:bg-stone-800 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
