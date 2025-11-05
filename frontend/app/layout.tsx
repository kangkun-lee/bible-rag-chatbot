import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '성경 QA 챗봇',
  description: '성경 내용을 기반으로 한 질문-답변 챗봇',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

