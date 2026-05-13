import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GTF Axis Validation',
  description: 'Task 3 Tinder Validation Tool for GTF v8.1 extraction review',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
