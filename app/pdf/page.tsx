import { Suspense } from 'react'
import { PdfViewerClient } from './PdfViewerClient'

export default function PdfViewerPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-stone-900 flex items-center justify-center text-stone-400 text-sm">Loading…</div>}>
      <PdfViewerClient />
    </Suspense>
  )
}
