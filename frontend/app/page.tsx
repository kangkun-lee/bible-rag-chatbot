'use client'

import Chat from '@/components/Chat'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold text-center mb-4">성경 QA 챗봇</h1>
        <p className="text-sm text-gray-600 text-center mb-8">
          출처: 대한성서공회, 1961 개정 '성경전서 개역한글판'
        </p>
        <Chat />
      </div>
    </main>
  )
}

