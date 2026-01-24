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
      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} transition-all duration-500 ease-out`}
    >
      <div
        className={`relative max-w-[90%] sm:max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 transition-all duration-200 shadow-sm
          ${message.isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-md'
            : 'bg-card text-card-foreground border border-border/40 rounded-tl-sm backdrop-blur-sm'
          }`}
      >
        {message.isLoading && !message.isUser && !message.text ? (
          <div className="flex items-center space-x-2 py-2 px-1">
            <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        ) : message.isUser ? (
          <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-white dark:text-white">
            {message.text}
          </div>
        ) : (
          <div className="prose prose-sm md:prose-base max-w-none leading-relaxed break-words dark:prose-invert prose-headings:text-foreground prose-p:text-foreground">
            <div className="relative font-serif">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0 break-words leading-relaxed">{children}</p>,
                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-6 first:mt-0 tracking-tight">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 first:mt-0 tracking-tight">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-4 first:mt-0">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1.5 marker:text-muted-foreground">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1.5 marker:text-muted-foreground">{children}</ol>,
                  li: ({ children }) => <li className="ml-1">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground bg-muted/20 py-2 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground border border-border/50">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-muted/50 p-4 rounded-xl text-sm font-mono overflow-x-auto my-3 border border-border/50">
                        {children}
                      </code>
                    )
                  },
                  strong: ({ children }) => <strong className="font-semibold text-foreground/90">{children}</strong>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline decoration-primary/30 hover:decoration-primary transition-all break-all font-medium"
                    >
                      {children}
                    </a>
                  ),
                  hr: () => <hr className="my-6 border-border/40" />,
                }}
              >
                {message.text}
              </ReactMarkdown>
              {message.isLoading && !message.isUser && (
                <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary/50 animate-pulse rounded-full"></span>
              )}
            </div>
          </div>
        )}

        {!message.isLoading && message.text && (
          <div
            className={`mt-2 flex items-center gap-3 text-[10px] md:text-[11px] font-medium opacity-80 ${message.isUser ? 'justify-end text-white/80' : 'justify-start text-muted-foreground'}`}
          >
            {formattedTime && (
              <time dateTime={message.createdAt} className="tracking-wide uppercase">
                {formattedTime}
              </time>
            )}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${message.isUser
                  ? 'hover:bg-white/10 active:bg-white/20 text-white'
                  : 'hover:bg-secondary active:bg-secondary/80'
                }`}
              aria-label={copied ? '복사 완료' : '메시지 복사'}
            >
              <span className="tracking-tight">
                {copied ? '복사됨' : '복사'}
              </span>
              <svg
                className={`w-3 h-3 ${copied ? (message.isUser ? 'text-white' : 'text-primary') : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
            </button>
          </div>
        )}

        {/* 출처 표시 강화 - 카드 스타일 */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border/20">
            <button
              onClick={() => setShowSources(!showSources)}
              className="group flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-2 py-1 -ml-2"
              aria-expanded={showSources}
              aria-label={showSources ? '출처 숨기기' : '출처 보기'}
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary group-hover:bg-primary/10 transition-colors">
                <svg
                  className={`w-3 h-3 transition-transform duration-300 ${showSources ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <span>참고 구절 {message.sources.length}개</span>
              <span className="text-border mx-1">•</span>
              <span className="text-[10px] text-muted-foreground/80 font-normal">대한성서공회 개역한글</span>
            </button>

            {showSources && (
              <div className="space-y-3 pl-1 animate-in slide-in-from-top-2 fade-in duration-200">
                {message.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-border/40 bg-background/50 hover:bg-background hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                    <div className="px-4 py-3 pl-5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-serif font-bold text-foreground text-sm tracking-tight">
                          {source.book} {source.chapter}:{source.verse}
                        </span>
                      </div>
                      <p className="font-serif text-muted-foreground text-sm leading-relaxed line-clamp-3 group-hover:line-clamp-none group-hover:text-foreground transition-all">
                        {source.content}
                      </p>
                    </div>
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