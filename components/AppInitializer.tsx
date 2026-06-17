'use client'

import { useEffect } from 'react'
import { StorageService } from '@/lib/infra/storage'

const DARK_VARS  = { '--background': '#0a0a0a', '--foreground': '#ededed' }
const LIGHT_VARS = { '--background': '#ffffff', '--foreground': '#171717' }

function applyStoredTheme() {
  const t = StorageService.theme.get()
  const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  const vars = isDark ? DARK_VARS : LIGHT_VARS
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
}

export function AppInitializer() {
  useEffect(() => {
    applyStoredTheme()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => { if (StorageService.theme.get() === 'system') applyStoredTheme() }
    mq.addEventListener('change', onSystem)
    const onStorage = (e: StorageEvent) => { if (e.key === StorageService.themeKey) applyStoredTheme() }
    window.addEventListener('storage', onStorage)
    return () => {
      mq.removeEventListener('change', onSystem)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}

export { applyStoredTheme }
