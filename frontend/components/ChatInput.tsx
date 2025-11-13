'use client'

import { useState, useRef, useEffect } from 'react'
import BibleMention from './BibleMention'

interface ChatInputProps {
  onMessageSent: (message: string) => void
  isLoading?: boolean
  disabled?: boolean
}

export default function ChatInput({ onMessageSent, isLoading = false, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)


  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const mentionSourceRef = useRef<'typing' | 'button' | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading || disabled) return

    onMessageSent(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 맨션이 열려있을 때는 키보드 네비게이션을 BibleMention에서 처리
    if (showMention) {
      // ArrowUp, ArrowDown, Escape는 BibleMention에서 처리하도록 허용
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape') {
        return
      }
      // Enter 키는 Shift가 눌리지 않았을 때만 막기 (BibleMention에서 처리)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        // BibleMention의 키보드 핸들러가 처리하도록 함
        return
      }
    }
    
    // Enter 키만 누르면 제출, Shift+Enter는 줄바꿈
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading && !disabled) {
        onMessageSent(input.trim())
        setInput('')
        setShowMention(false)
      }
    }
  }

  // '@' 입력 감지 및 맨션 팝업 위치 계산
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = input.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    // '@' 입력 감지
    if (lastAtIndex !== -1) {
      const textAfterTrigger = textBeforeCursor.substring(lastAtIndex + 1)
      
      // 공백이나 줄바꿈이 없으면 맨션 활성화
      if (!textAfterTrigger.includes(' ') && !textAfterTrigger.includes('\n')) {
        mentionSourceRef.current = 'typing'
        setMentionQuery(textAfterTrigger)

        // 즉시 기본 위치 설정 (나중에 업데이트됨)
        const container = containerRef.current
        if (container) {
          const containerRect = container.getBoundingClientRect()
          setMentionPosition({
            top: containerRect.bottom + 8,
            left: containerRect.left,
            placement: 'bottom' as const
          })
        }
        
        setShowMention(true)

        // 위치 계산을 다음 프레임으로 지연시켜 DOM이 업데이트된 후 실행
        requestAnimationFrame(() => {
          const updatedContainer = containerRef.current
          if (updatedContainer) {
            const containerRect = updatedContainer.getBoundingClientRect()
            const popupHeight = 300 // max-h-[300px]
            const spaceBelow = window.innerHeight - containerRect.bottom
            const spaceAbove = containerRect.top
            
            // 아래 공간이 부족하고 위 공간이 더 많으면 위쪽으로 뒤집기
            const shouldFlipUp = spaceBelow < popupHeight + 8 && spaceAbove > spaceBelow
            
            if (shouldFlipUp) {
              // 위쪽으로 배치
              setMentionPosition({
                top: containerRect.top - popupHeight - 8,
                left: containerRect.left,
                placement: 'top' as const
              })
            } else {
              // 아래쪽으로 배치
              setMentionPosition({
                top: containerRect.bottom + 8,
                left: containerRect.left,
                placement: 'bottom' as const
              })
            }
          }
        })
        return
      }
    }

    // '@'가 없거나 공백/줄바꿈이 있으면 맨션 닫기
    if (mentionSourceRef.current === 'typing') {
      mentionSourceRef.current = null
      setShowMention(false)
      setMentionPosition(null)
    }
  }, [input])

  const handleMentionSelect = (bookName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = input.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      // '@'로 시작하는 경우 '@'를 제거하고 책 이름만 삽입
      const textAfterCursor = input.substring(cursorPosition)
      const newText = 
        input.substring(0, lastAtIndex) + 
        bookName + 
        ' ' + 
        textAfterCursor
      
      setInput(newText)
      mentionSourceRef.current = null
      setShowMention(false)
      setMentionPosition(null)
      
      // 커서 위치 조정
      setTimeout(() => {
        const newCursorPosition = lastAtIndex + bookName.length + 1
        textarea.setSelectionRange(newCursorPosition, newCursorPosition)
        textarea.focus()
      }, 0)
    } else {
      // 버튼 클릭으로 열린 경우 현재 커서 위치에 삽입
      const textAfterCursor = input.substring(cursorPosition)
      const newText = input.substring(0, cursorPosition) + bookName + ' ' + textAfterCursor
      
      setInput(newText)
      mentionSourceRef.current = null
      setShowMention(false)
      setMentionPosition(null)
      
      // 커서 위치 조정
      setTimeout(() => {
        const newCursorPosition = cursorPosition + bookName.length + 1
        textarea.setSelectionRange(newCursorPosition, newCursorPosition)
        textarea.focus()
      }, 0)
    }
  }

  const handleMentionButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const willShow = !showMention
    setShowMention(willShow)
    setMentionQuery('')
    
    if (willShow) {
      mentionSourceRef.current = 'button'
      
      // 즉시 기본 위치 설정 (나중에 업데이트됨)
      const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setMentionPosition({
        top: buttonRect.bottom + 8,
        left: buttonRect.left,
        placement: 'bottom' as const
      })
      
      // 위치 계산을 다음 프레임으로 지연시켜 DOM이 업데이트된 후 실행
      requestAnimationFrame(() => {
        const container = containerRef.current
        const popupHeight = 300 // max-h-[300px]
        
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const spaceBelow = window.innerHeight - containerRect.bottom
          const spaceAbove = containerRect.top
          
          // 아래 공간이 부족하고 위 공간이 더 많으면 위쪽으로 뒤집기
          const shouldFlipUp = spaceBelow < popupHeight + 8 && spaceAbove > spaceBelow
          
          if (shouldFlipUp) {
            // 위쪽으로 배치
            setMentionPosition({
              top: containerRect.top - popupHeight - 8,
              left: containerRect.left,
              placement: 'top' as const
            })
          } else {
            // 아래쪽으로 배치
            setMentionPosition({
              top: containerRect.bottom + 8,
              left: containerRect.left,
              placement: 'bottom' as const
            })
          }
        } else {
          // 컨테이너가 없으면 버튼 기준으로 계산
          const currentButtonRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const spaceBelow = window.innerHeight - currentButtonRect.bottom
          const spaceAbove = currentButtonRect.top
          const shouldFlipUp = spaceBelow < popupHeight + 8 && spaceAbove > spaceBelow
          
          if (shouldFlipUp) {
            setMentionPosition({
              top: currentButtonRect.top - popupHeight - 8,
              left: currentButtonRect.left,
              placement: 'top' as const
            })
          } else {
            setMentionPosition({
              top: currentButtonRect.bottom + 8,
              left: currentButtonRect.left,
              placement: 'bottom' as const
            })
          }
        }
      })
      
      setTimeout(() => textareaRef.current?.focus(), 0)
    } else {
      mentionSourceRef.current = null
      setMentionPosition(null)
    }
  }

  // textarea 높이 자동 조정
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 높이 초기화
    textarea.style.height = 'auto'
    
    // 내용에 맞게 높이 조정 (최대 4줄)
    const scrollHeight = textarea.scrollHeight
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight)
    const maxHeight = lineHeight * 4 + parseFloat(getComputedStyle(textarea).paddingTop) + parseFloat(getComputedStyle(textarea).paddingBottom)
    
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
  }, [input])

  // isLoading이 false로 변경되면 textarea에 포커스
  useEffect(() => {
    if (!isLoading && !disabled) {
      // 약간의 지연을 두어 상태 업데이트가 완전히 반영된 후 포커스
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isLoading, disabled])

  return (
    <form 
      onSubmit={handleSubmit} 
      className="relative overflow-visible" 
      aria-busy={isLoading || disabled}
    >
      <div ref={containerRef} className="relative w-full overflow-visible">
        <div
          className={`group flex items-center gap-3 rounded-2xl border border-border/70 bg-white/95 backdrop-blur-sm px-4 py-3 md:px-6 md:py-4 shadow-[0_18px_36px_rgba(15,23,42,0.12)] transition-all duration-200 ${
          disabled ? 'opacity-75 cursor-not-allowed' : ''
        }`}
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={handleMentionButtonClick}
            className="w-12 h-12 rounded-xl border border-border/60 bg-secondary/40 text-foreground flex items-center justify-center transition-all duration-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-secondary/60"
            aria-label="성경 선택"
            disabled={isLoading || disabled}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="질문을 입력하세요... (예: 창세기 1:1 의미)"
            rows={1}
            className="flex-1 px-5 py-4 md:py-5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-200 placeholder:text-muted-foreground text-foreground text-base md:text-lg font-medium min-h-[56px] md:min-h-[64px] shadow-sm disabled:bg-muted/50 disabled:cursor-not-allowed resize-none overflow-y-auto leading-relaxed"
            disabled={disabled}
            aria-label="질문 입력"
            aria-required="true"
            style={{
              lineHeight: '1.5',
              maxHeight: 'calc(4 * 1.5em + 2.5rem + 1rem)'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || disabled}
            className="inline-flex items-center gap-2 px-6 md:px-8 py-4 md:py-5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-200 text-base md:text-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-md min-h-[56px] md:min-h-[64px]"
            aria-label={isLoading ? '응답 생성 중' : '전송'}
          >
            <span>{isLoading ? '생성 중…' : '전송'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      
        {/* 맨션 팝업 */}
        <BibleMention
          isOpen={showMention}
          onClose={() => {
            mentionSourceRef.current = null
            setShowMention(false)
            setMentionPosition(null)
          }}
          onSelect={handleMentionSelect}
          searchQuery={mentionQuery}
          position={mentionPosition}
          excludeElementRef={buttonRef}
        />
      </div>
    </form>
  )
}

