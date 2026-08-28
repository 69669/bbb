import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AntiDebugProvider from '../components/AntiDebugProvider'

export const metadata: Metadata = {
  title: '后台管理',
  description: '后台管理系统',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '后台管理',
  },
  other: {
    'format-detection': 'telephone=no',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://api.ttla.top" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.ttla.top" />
      </head>
      <body>
        <AntiDebugProvider>
          {children}
        </AntiDebugProvider>
      </body>
    </html>
  )
}
