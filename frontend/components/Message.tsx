'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface MessageProps {
  message: {
    id: string
    text: string
    isUser: boolean
    isLoading?: boolean
    createdAt?: string
    sources?: Array<{
      book: string
      chapter: string
      verse: string
      content: string
    }>
  }
  index: number
}

export default function Message({ message, index }: MessageProps) {
  const [showSources, setShowSources] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatTimestamp = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return new Intl.DateTimeFormat('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formattedTime = message.createdAt ? formatTimestamp(message.createdAt) : ''

  useEffect(() => {
    // 클라이언트에서만 마운트 상태 설정 (hydration 경고 방지)
    setIsMounted(true)
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    if (!message.text) return
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('복사 실패:', error)
    }
  }

  return (
    <div 
      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} ${isMounted ? 'opacity-100' : 'opacity-0'} transition-opacity duration-150`}
    >
      <div
        className={`relative max-w-[65%] md:max-w-[60%] rounded-xl p-4 md:p-5 transition-all duration-150 ${
          message.isUser
            ? 'bg-primary shadow-md'
            : 'bg-white text-foreground shadow-sm border border-border/50'
        }`}
        style={message.isUser ? { color: '#FFFFFF' } : undefined}
      >
        {message.isLoading && !message.isUser ? (
          <div className="flex items-center space-x-3 py-2">
            <div className="loader"></div>
            <span className="text-sm text-muted-foreground">생성 중...</span>
          </div>
        ) : (
          <div 
            className="prose prose-sm md:prose-base max-w-none leading-relaxed mb-2"
            style={message.isUser ? { color: '#FFFFFF' } : undefined}
          >
            {message.isUser ? (
              <p className="whitespace-pre-wrap" style={{ color: '#FFFFFF' }}>
                {message.text}
              </p>
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="ml-2">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-border/50 pl-4 italic my-2">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-secondary/50 p-3 rounded text-sm font-mono overflow-x-auto my-2">
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="bg-secondary/50 p-3 rounded text-sm font-mono overflow-x-auto my-2">
                      {children}
                    </pre>
                  ),
                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                    >
                      {children}
                    </a>
                  ),
                  hr: () => <hr className="my-4 border-border/50" />,
                }}
              >
                {message.text}
              </ReactMarkdown>
            )}
          </div>
        )}
        
        {!message.isLoading && message.text && (
          <div
            className={`mt-3 flex items-center gap-2 text-[11px] ${message.isUser ? 'justify-end text-white/80' : 'justify-start text-muted-foreground'}`}
          >
            {formattedTime && (
              <time dateTime={message.createdAt} className="tracking-tight">
                {formattedTime}
              </time>
            )}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                message.isUser
                  ? 'bg-white/20 text-white hover:bg-white/30 focus:ring-white/60'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
              aria-label={copied ? '복사 완료' : '메시지 복사'}
            >
              <svg
                className={`w-3.5 h-3.5 ${copied ? (message.isUser ? 'text-white' : 'text-primary') : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </>
                )}
              </svg>
              <span className="tracking-tight">
                {copied ? '복사됨' : '복사'}
              </span>
            </button>
          </div>
        )}

        {/* 출처 표시 강화 */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-xs md:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md px-1"
              aria-expanded={showSources}
              aria-label={showSources ? '출처 숨기기' : '출처 보기'}
            >
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>참고 구절 {message.sources.length}개</span>
              <span className="text-foreground ml-1">•</span>
              <span className="text-xs text-muted-foreground">개역한글(1961), 대한성서공회</span>
            </button>
            
            {showSources && (
              <div className="space-y-3">
                {message.sources.map((source, idx) => (
                  <div 
                    key={idx} 
                    className="px-4 py-3 rounded-xl text-sm transition-all duration-150 cursor-pointer hover:bg-secondary bg-white border border-border/50 shadow-sm"
                    role="button"
                    tabIndex={0}
                    aria-label={`${source.book} ${source.chapter}:${source.verse} 구절 보기`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="font-bold text-foreground text-base">
                        {source.book} {source.chapter}:{source.verse}
                      </span>
                      <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border/50">
                        성경
                      </span>
                    </div>
                    <p className="text-foreground text-sm leading-relaxed mt-2">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
