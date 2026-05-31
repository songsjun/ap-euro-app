'use client'

import { useSearchParams } from 'next/navigation'

export function PdfViewerClient() {
  const params = useSearchParams()
  const page = Math.max(1, parseInt(params.get('page') ?? '1') || 1)
  // AMSCO textbook page offset: pdf_page 47 = textbook p.1
  const textbookPage = page - 46
  const pageLabel = textbookPage > 0 ? `教材 p.${textbookPage}` : `PDF p.${page}`

  return (
    <div className="fixed inset-0 flex flex-col bg-stone-900">
      {/* Slim header */}
      <div className="h-9 shrink-0 bg-stone-800 border-b border-stone-700 flex items-center px-4 gap-3">
        <button
          onClick={() => window.close()}
          className="text-stone-400 hover:text-stone-200 transition-colors text-xs flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          关闭
        </button>
        <span className="flex-1 text-center text-xs text-stone-400">
          AMSCO AP European History
          <span className="text-stone-500 ml-2">{pageLabel}</span>
        </span>
        <a
          href="/amsco.pdf"
          download="AMSCO_AP_Euro.pdf"
          className="text-stone-500 hover:text-stone-300 transition-colors text-xs">
          下载
        </a>
      </div>

      {/* PDF iframe — same-origin ensures #page=N is honored by browser PDF viewer */}
      <iframe
        src={`/amsco.pdf#page=${page}`}
        className="flex-1 w-full border-0"
        title={`AMSCO AP European History — ${pageLabel}`}
      />
    </div>
  )
}
