import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppInitializer } from '@/components/AppInitializer'
import { AuthGate } from '@/components/AuthGate'
import { VersionBadge } from '@/components/VersionBadge'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AP European History',
  description: 'Adaptive AP European History learning platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          `(function(){try{` +
          `var t=localStorage.getItem('ap_euro_theme');` +
          `var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);` +
          `var r=document.documentElement;` +
          `if(d){r.classList.add('dark');` +
          `r.style.setProperty('--background','#0a0a0a');` +
          `r.style.setProperty('--foreground','#ededed');}` +
          `}catch(e){}})();`
        }} />
      </head>
      <body className="min-h-full bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100">
        <AppInitializer />
        <AuthGate>{children}</AuthGate>
        <VersionBadge />
      </body>
    </html>
  )
}
