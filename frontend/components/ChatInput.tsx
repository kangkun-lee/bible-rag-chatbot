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
  const [isFocused, setIsFocused] = useState(false)

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
    if (showMention) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Escape') {
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        return
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading && !disabled) {
        onMessageSent(input.trim())
        setInput('')
        setShowMention(false)
      }
    }
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = input.substring(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterTrigger = textBeforeCursor.substring(lastAtIndex + 1)
      
      if (!textAfterTrigger.includes(' ') && !textAfterTrigger.includes('\n')) {
        mentionSourceRef.current = 'typing'
        setMentionQuery(textAfterTrigger)

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

        requestAnimationFrame(() => {
          const updatedContainer = containerRef.current
          if (updatedContainer) {
            const containerRect = updatedContainer.getBoundingClientRect()
            const popupHeight = 300 
            const spaceBelow = window.innerHeight - containerRect.bottom
            const spaceAbove = containerRect.top
            
            const shouldFlipUp = spaceBelow < popupHeight + 8 && spaceAbove > spaceBelow
            
            if (shouldFlipUp) {
              setMentionPosition({
                top: containerRect.top - popupHeight - 8,
                left: containerRect.left,
                placement: 'top' as const
              })
            } else {
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
      
      setTimeout(() => {
        const newCursorPosition = lastAtIndex + bookName.length + 1
        textarea.setSelectionRange(newCursorPosition, newCursorPosition)
        textarea.focus()
      }, 0)
    } else {
      const textAfterCursor = input.substring(cursorPosition)
      const newText = input.substring(0, cursorPosition) + bookName + ' ' + textAfterCursor
      
      setInput(newText)
      mentionSourceRef.current = null
      setShowMention(false)
      setMentionPosition(null)
      
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
      
      const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setMentionPosition({
        top: buttonRect.bottom + 8,
        left: buttonRect.left,
        placement: 'bottom' as const
      })
      
      requestAnimationFrame(() => {
        const container = containerRef.current
        const popupHeight = 300 
        
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const spaceBelow = window.innerHeight - containerRect.bottom
          const spaceAbove = containerRect.top
          
          const shouldFlipUp = spaceBelow < popupHeight + 8 && spaceAbove > spaceBelow
          
          if (shouldFlipUp) {
            setMentionPosition({
              top: containerRect.top - popupHeight - 8,
              left: containerRect.left,
              placement: 'top' as const
            })
          } else {
            setMentionPosition({
              top: containerRect.bottom + 8,
              left: containerRect.left,
              placement: 'bottom' as const
            })
          }
        } else {
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

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    
    const scrollHeight = textarea.scrollHeight
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight)
    const maxHeight = lineHeight * 4 + parseFloat(getComputedStyle(textarea).paddingTop) + parseFloat(getComputedStyle(textarea).paddingBottom)
    
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
  }, [input])

  useEffect(() => {
    if (!isLoading && !disabled) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isLoading, disabled])

  return (
    <form 
      onSubmit={handleSubmit} 
      className="relative overflow-visible mx-auto max-w-4xl" 
      aria-busy={isLoading || disabled}
    >
      <div ref={containerRef} className="relative w-full overflow-visible">
        <div
          className={`group flex items-center gap-2 rounded-[2rem] border transition-all duration-300 backdrop-blur-xl px-2 py-2 md:px-3 md:py-2.5 shadow-lg
            ${isFocused 
              ? 'border-primary/50 bg-background/95 ring-4 ring-primary/10 shadow-primary/5' 
              : 'border-border/40 bg-background/80 hover:bg-background/90 hover:border-border/60 hover:shadow-xl'
            }
            ${disabled ? 'opacity-75 cursor-not-allowed' : ''}
          `}
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={handleMentionButtonClick}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
              ${showMention 
                ? 'bg-primary text-primary-foreground rotate-180' 
                : 'bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground'
              }
            `}
            aria-label="성경 선택"
            disabled={isLoading || disabled}
          >
            <svg className="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {showMention ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              )}
            </svg>
          </button>
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="성경에 대해 무엇이든 물어보세요..."
            rows={1}
            className="flex-1 px-3 py-3 bg-transparent border-0 focus:ring-0 resize-none overflow-y-auto leading-relaxed text-foreground placeholder:text-muted-foreground/70 text-base md:text-lg max-h-[120px] scrollbar-hide"
            disabled={disabled}
            aria-label="질문 입력"
            aria-required="true"
            style={{
              lineHeight: '1.5',
            }}
          />
          
          <button
            type="submit"
            disabled={isLoading || !input.trim() || disabled}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
              ${input.trim() && !isLoading
                ? 'bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95' 
                : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
              }
            `}
            aria-label={isLoading ? '응답 생성 중' : '전송'}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      
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