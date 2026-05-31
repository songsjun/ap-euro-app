'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { StorageService, type ThemePreference } from '@/lib/infra/storage'
import { ensureAppReady } from '@/lib/app/ready'
import { exportData, importData, downloadJson } from '@/lib/app/share'
import type { ExportData } from '@/lib/types'

export function SettingsClient() {
  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ensureAppReady().then(() => {
      setSavedKey(StorageService.apiKey.get())
      setTheme(StorageService.theme.get())
    }).catch(console.error)
  }, [])

  function handleSaveKey() {
    const trimmed = apiKey.trim()
    if (!trimmed) return
    StorageService.apiKey.save(trimmed)
    setSavedKey(trimmed)
    setApiKey('')
  }

  function handleClearKey() {
    StorageService.apiKey.clear()
    setSavedKey(null)
  }

  function handleTheme(t: ThemePreference) {
    setTheme(t)
    StorageService.theme.save(t)
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) root.classList.add('dark')
    } else {
      root.classList.add(t)
    }
  }

  async function handleExport() {
    setExportStatus('loading')
    try {
      const data = await exportData()
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(data, `ap-euro-backup-${date}.json`)
      setExportStatus('done')
      setTimeout(() => setExportStatus('idle'), 2000)
    } catch (e) {
      console.error(e)
      setExportStatus('idle')
    }
  }

  function handleImportClick() {
    fileRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('loading')
    setImportError('')
    try {
      const text = await file.text()
      const data = JSON.parse(text) as ExportData
      await importData(data)
      setImportStatus('done')
      setTimeout(() => setImportStatus('idle'), 2000)
    } catch (err) {
      setImportStatus('error')
      setImportError(err instanceof Error ? err.message : '导入失败，请检查文件格式')
    }
    e.target.value = ''
  }

  const maskedKey = savedKey
    ? `${savedKey.slice(0, 8)}${'·'.repeat(Math.min(20, savedKey.length - 8))}`
    : null

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">设置</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Theme */}
        <Section title="外观">
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as ThemePreference[]).map(t => (
              <button key={t}
                onClick={() => handleTheme(t)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                  theme === t
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                }`}>
                {t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
              </button>
            ))}
          </div>
        </Section>

        {/* API Key */}
        <Section title="Claude API Key（可选）">
          <p className="text-xs text-stone-400 dark:text-stone-500 mb-3">
            填写后可在 Topic 完成时获取 AI 学习反馈。Key 仅存储在本地浏览器。
          </p>
          {savedKey ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-3 py-2 rounded-lg font-mono truncate">
                {maskedKey}
              </code>
              <button onClick={handleClearKey}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 transition-colors">
                清除
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 text-sm border border-stone-300 dark:border-stone-600 rounded-lg px-3 py-2 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 transition-colors">
                保存
              </button>
            </div>
          )}
        </Section>

        {/* Data */}
        <Section title="数据管理">
          <div className="space-y-2">
            <button
              onClick={handleExport}
              disabled={exportStatus === 'loading'}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 transition-all">
              <div className="text-left">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">导出进度数据</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">下载 JSON 备份文件</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                exportStatus === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                exportStatus === 'loading' ? 'text-stone-400' : 'text-blue-500'
              }`}>
                {exportStatus === 'done' ? '已下载' : exportStatus === 'loading' ? '处理中…' : '导出'}
              </span>
            </button>

            <button
              onClick={handleImportClick}
              disabled={importStatus === 'loading'}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 transition-all">
              <div className="text-left">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">导入进度数据</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">从备份文件恢复</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                importStatus === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                importStatus === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                importStatus === 'loading' ? 'text-stone-400' : 'text-blue-500'
              }`}>
                {importStatus === 'done' ? '已导入' :
                 importStatus === 'error' ? '失败' :
                 importStatus === 'loading' ? '处理中…' : '导入'}
              </span>
            </button>
            {importStatus === 'error' && importError && (
              <p className="text-xs text-red-500 dark:text-red-400 px-1">{importError}</p>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </Section>

        {/* About */}
        <Section title="关于">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            AP European History 自适应学习平台<br />
            数据存储于本地浏览器 IndexedDB，不上传任何个人信息。
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-2 px-1">
        {title}
      </p>
      <div className="bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 rounded-xl p-4">
        {children}
      </div>
    </div>
  )
}
