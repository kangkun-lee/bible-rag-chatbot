'use client'

import { useState, useRef, useEffect } from 'react'
import Message from './Message'
import { sendMessage, sendMessageStream } from '../lib/api'

interface MessageData {
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

interface ChatProps {
  initialMessage?: string | null
  onMessageSent?: () => void
  onLoadingChange?: (isLoading: boolean) => void
  showMessages?: boolean
  showInput?: boolean
  externalMessage?: string | null
  conversationId?: string | null
  initialMessages?: Array<{
    id: string
    role: string
    content: string
    created_at?: string
    sources?: Array<{
      book: string
      chapter: string
      verse: string
      content: string
    }>
  }>
  onConversationIdChange?: (conversationId: string | null, options?: { skipAutoFetch?: boolean }) => void
}

export default function Chat({ initialMessage, onMessageSent, onLoadingChange, showMessages = true, showInput = true, externalMessage, conversationId, initialMessages, onConversationIdChange }: ChatProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(conversationId || null)
  const processedMessagesRef = useRef<Set<string>>(new Set())
  const skipInitialLoadRef = useRef(false)

  // isLoading 상태 변경 시 부모에게 알림
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading)
    }
  }, [isLoading, onLoadingChange])

  // 대화 ID 변경 시 메시지 초기화 및 로드
  useEffect(() => {
    // conversationIdRef를 항상 prop과 동기화 (중요: 새 대화 시작 시 null로 초기화)
    const previousConversationId = conversationIdRef.current
    conversationIdRef.current = conversationId || null

    // 새 대화 시작 (conversationId가 null로 변경된 경우 또는 처음부터 null인 경우)
    if (!conversationId) {
      // 새 대화 시작 시 무조건 메시지 비우기 (이전 대화에서 전환된 경우 또는 처음부터 새 대화인 경우)
      if (previousConversationId !== null || messages.length > 0) {
        setMessages([])
        setInput('')
        processedMessagesRef.current.clear()
      }
      skipInitialLoadRef.current = false
      // 새 대화인 경우 initialMessages를 무시하고 여기서 종료
      return
    }

    // 스트리밍 중이거나 skip 플래그가 설정된 경우 초기화하지 않음
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false
      return
    }

    // 스트리밍 중일 때는 메시지를 초기화하지 않음
    if (isLoading) {
      return
    }

    if (conversationId) {
      if (initialMessages && initialMessages.length > 0) {
        // Supabase에서 가져온 메시지를 MessageData 형식으로 변환
        const formattedMessages: MessageData[] = initialMessages.map((msg) => ({
          id: msg.id,
          text: msg.content,
          isUser: msg.role === 'user',
          createdAt: msg.created_at,
          sources: msg.sources || undefined,
        }))
        setMessages(formattedMessages)
      } else if (previousConversationId !== conversationId) {
        // conversationId가 변경되었고 initialMessages가 없는 경우 메시지 비우기
        setMessages([])
      }
    } else {
      // conversationId가 null인 경우 (새 대화) - 항상 메시지 비우기
      setMessages([])
    }
    setInput('')
    processedMessagesRef.current.clear()
  }, [conversationId, initialMessages, isLoading])

  useEffect(() => {
    if (initialMessage && !processedMessagesRef.current.has(initialMessage)) {
      processedMessagesRef.current.add(initialMessage)
      
      const handleInitialMessage = async () => {
        const userTimestamp = new Date().toISOString()
        const userMessage: MessageData = {
          id: Date.now().toString(),
          text: initialMessage,
          isUser: true,
          createdAt: userTimestamp,
        }

        setMessages((prev) => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
          // 스트리밍 사용
          const aiMessageId = (Date.now() + 1).toString()
          const aiMessageTimestamp = new Date().toISOString()
          // 계산 중 애니메이션을 표시하는 메시지 추가
          const loadingMessage: MessageData = {
            id: aiMessageId,
            text: '',
            isUser: false,
            sources: undefined,
            isLoading: true,
            createdAt: aiMessageTimestamp,
          }
          setMessages((prev) => [...prev, loadingMessage])
          
          let accumulatedText = ''
          // conversationId prop을 우선 사용하고, 없으면 ref 사용 (새 대화 시작 시 null 보장)
          let currentConversationId = conversationId || conversationIdRef.current || null
          let streamCompleted = false
          let firstTokenReceived = false
          
          try {
            for await (const event of sendMessageStream(initialMessage, currentConversationId)) {
              if (event.type === 'start') {
                if (event.conversation_id) {
                  currentConversationId = event.conversation_id
                  const previousConversationId = conversationIdRef.current
                  conversationIdRef.current = currentConversationId
                  skipInitialLoadRef.current = true
                  // 상위 컴포넌트에 conversation_id 전달
                  if (
                    onConversationIdChange &&
                    currentConversationId &&
                    currentConversationId !== previousConversationId
                  ) {
                    onConversationIdChange(currentConversationId, { skipAutoFetch: true })
                  }
                }
              } else if (event.type === 'token' && event.content) {
                accumulatedText += event.content
                // 첫 토큰이 도착하면 로딩 메시지를 실제 텍스트로 교체
                if (!firstTokenReceived) {
                  firstTokenReceived = true
                  const aiMessage: MessageData = {
                    id: aiMessageId,
                    text: accumulatedText,
                    isUser: false,
                    sources: undefined,
                    isLoading: false,
                    createdAt: aiMessageTimestamp,
                  }
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId ? aiMessage : msg
                    )
                  )
                } else {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, text: accumulatedText }
                        : msg
                    )
                  )
                }
                // 스트리밍 중에도 스크롤 (사용자가 맨 아래에 있을 때만)
                if (shouldAutoScrollRef.current) {
                  requestAnimationFrame(() => {
                    scrollToBottom(true)
                  })
                }
              } else if (event.type === 'done') {
                streamCompleted = true
                if (event.sources) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, sources: event.sources }
                        : msg
                    )
                  )
                }
                // 스트리밍 완료 시 로딩 상태 해제
                setIsLoading(false)
                if (onMessageSent) onMessageSent()
                break
              } else if (event.type === 'error') {
                streamCompleted = true
                
                // 에러 메시지 처리
                let errorText = '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'
                if (event.content) {
                  if (event.content.includes('overloaded') || event.content.includes('503') || event.content.includes('The model is overloaded')) {
                    errorText = 'AI 모델이 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
                  } else if (event.content.includes('처리 중 오류가 발생했습니다')) {
                    // 백엔드에서 온 에러 메시지 추출
                    errorText = event.content
                  }
                }
                
                // 로딩 메시지를 에러 메시지로 교체
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId && msg.isLoading
                      ? {
                          ...msg,
                          text: errorText,
                          isLoading: false,
                        }
                      : msg
                  )
                )
                setIsLoading(false)
                break
              }
            }
            
            // 스트리밍이 완료되지 않은 경우 대비
            if (!streamCompleted) {
              setIsLoading(false)
            }
          } catch (streamError) {
            setIsLoading(false)
            throw streamError
          } finally {
            // 최종적으로 로딩 상태 해제 보장
            setIsLoading(false)
          }
        } catch (error) {
          const errorMessage: MessageData = {
            id: (Date.now() + 1).toString(),
            text: `죄송합니다. 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}. API URL을 확인해주세요.`,
            isUser: false,
          }
          setMessages((prev) => [...prev, errorMessage])
          setIsLoading(false)
        } finally {
          setIsLoading(false)
          if (onMessageSent) onMessageSent()
        }
      }
      handleInitialMessage()
    }
  }, [initialMessage, onMessageSent])

  useEffect(() => {
    if (externalMessage && externalMessage !== initialMessage && !processedMessagesRef.current.has(externalMessage)) {
      processedMessagesRef.current.add(externalMessage)
      
      const handleExternalMessage = async () => {
      const userTimestamp = new Date().toISOString()
      const userMessage: MessageData = {
          id: Date.now().toString(),
          text: externalMessage,
          isUser: true,
        createdAt: userTimestamp,
        }

        setMessages((prev) => [...prev, userMessage])
        setIsLoading(true)

        try {
          // 스트리밍 사용
        const aiMessageId = (Date.now() + 1).toString()
        const aiMessageTimestamp = new Date().toISOString()
          // 계산 중 애니메이션을 표시하는 메시지 추가
          const loadingMessage: MessageData = {
            id: aiMessageId,
            text: '',
            isUser: false,
            sources: undefined,
            isLoading: true,
          createdAt: aiMessageTimestamp,
          }
          setMessages((prev) => [...prev, loadingMessage])
          
          let accumulatedText = ''
          // conversationId prop을 우선 사용하고, 없으면 ref 사용 (새 대화 시작 시 null 보장)
          let currentConversationId = conversationId || conversationIdRef.current || null
          let streamCompleted = false
          let firstTokenReceived = false
          
          try {
            for await (const event of sendMessageStream(externalMessage, currentConversationId)) {
              if (event.type === 'start') {
                if (event.conversation_id) {
                  currentConversationId = event.conversation_id
                  const previousConversationId = conversationIdRef.current
                  conversationIdRef.current = currentConversationId
                  skipInitialLoadRef.current = true
                  // 상위 컴포넌트에 conversation_id 전달
                  if (
                    onConversationIdChange &&
                    currentConversationId &&
                    currentConversationId !== previousConversationId
                  ) {
                    onConversationIdChange(currentConversationId, { skipAutoFetch: true })
                  }
                }
              } else if (event.type === 'token' && event.content) {
                accumulatedText += event.content
                // 첫 토큰이 도착하면 로딩 메시지를 실제 텍스트로 교체
                if (!firstTokenReceived) {
                  firstTokenReceived = true
                const aiMessage: MessageData = {
                    id: aiMessageId,
                    text: accumulatedText,
                    isUser: false,
                    sources: undefined,
                    isLoading: false,
                  createdAt: aiMessageTimestamp,
                  }
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId ? aiMessage : msg
                    )
                  )
                } else {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, text: accumulatedText }
                        : msg
                    )
                  )
                }
                // 스트리밍 중에도 스크롤 (사용자가 맨 아래에 있을 때만)
                if (shouldAutoScrollRef.current) {
                  requestAnimationFrame(() => {
                    scrollToBottom(true)
                  })
                }
              } else if (event.type === 'done') {
                streamCompleted = true
                if (event.sources) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, sources: event.sources }
                        : msg
                    )
                  )
                }
                // 스트리밍 완료 시 로딩 상태 해제
                setIsLoading(false)
                break
              } else if (event.type === 'error') {
                streamCompleted = true
                setIsLoading(false)
                break
              }
            }
            
            // 스트리밍이 완료되지 않은 경우 대비
            if (!streamCompleted) {
              setIsLoading(false)
            }
          } catch (streamError) {
            setIsLoading(false)
            throw streamError
          } finally {
            // 최종적으로 로딩 상태 해제 보장
            setIsLoading(false)
          }
        } catch (error) {
          const errorMessage: MessageData = {
            id: (Date.now() + 1).toString(),
            text: `죄송합니다. 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}. API URL을 확인해주세요.`,
            isUser: false,
          }
          setMessages((prev) => [...prev, errorMessage])
          setIsLoading(false)
        }
      }
      handleExternalMessage()
    }
  }, [externalMessage, initialMessage])

  const shouldAutoScrollRef = useRef(true)

  const getScrollContainer = (): HTMLElement | null => {
    // main-content ID를 가진 스크롤 컨테이너 우선 사용
    const byId = document.getElementById('main-content')
    if (byId) {
      return byId
    }

    // data 속성으로 명시된 컨테이너가 있으면 사용
    const byData = document.querySelector('[data-scroll-container="chat"]') as HTMLElement | null
    if (byData) {
      return byData
    }

    return null
  }

  const scrollToBottom = (force = false) => {
    if (!force && !shouldAutoScrollRef.current) {
      return
    }
    
    const container = getScrollContainer()
    if (container) {
      // 모바일에서 더 확실한 스크롤을 위해 여러 방법 시도
      const scrollHeight = container.scrollHeight
      
      // 1. 즉시 스크롤
      container.scrollTop = scrollHeight
      
      // 2. requestAnimationFrame으로 다시 시도
      requestAnimationFrame(() => {
        container.scrollTop = scrollHeight
        // 3. scrollTo로 smooth 스크롤
        setTimeout(() => {
          container.scrollTo({
            top: scrollHeight,
            behavior: 'smooth'
          })
        }, 10)
      })
      
      // 4. 추가 보장을 위해 한 번 더
      setTimeout(() => {
        const finalScrollTop = container.scrollTop
        if (finalScrollTop < scrollHeight - 50) {
          container.scrollTop = scrollHeight
        }
      }, 100)
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
    }
  }

  // 스크롤 위치 감지
  useEffect(() => {
    const container = getScrollContainer()
    if (!container) {
      return
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100 // 100px 여유
      
      // 사용자가 맨 아래 근처에 있으면 자동 스크롤 활성화
      shouldAutoScrollRef.current = isNearBottom
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // 최초 렌더링 시 자동 스크롤 활성화
  useEffect(() => {
    const container = getScrollContainer()
    if (container) {
      shouldAutoScrollRef.current = true
      scrollToBottom(true)
    }
  }, [])

  // 초기 로드 시 스크롤 위치 일관성 개선 (메시지가 없을 때는 항상 상단)
  useEffect(() => {
    const container = getScrollContainer()
    if (container && messages.length === 0) {
      // 초기 상태에서는 항상 상단에 위치
      container.scrollTop = 0
      shouldAutoScrollRef.current = true
    }
  }, [messages.length])

  useEffect(() => {
    // 새 메시지가 추가되거나 메시지 내용이 업데이트될 때 자동 스크롤 (사용자가 맨 아래에 있을 때만)
    if (shouldAutoScrollRef.current) {
      // 모바일에서 더 확실한 스크롤을 위해 여러 단계로 시도
      const container = getScrollContainer()
      if (container) {
        // 즉시 스크롤
        container.scrollTop = container.scrollHeight
        // 다음 프레임에서 다시 스크롤
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight
          // 한 번 더 smooth 스크롤
          setTimeout(() => {
            scrollToBottom(true)
          }, 50)
        })
      } else {
        requestAnimationFrame(() => {
          setTimeout(() => scrollToBottom(), 0)
        })
      }
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent, messageText?: string) => {
    e.preventDefault()
    
    const textToSend = messageText || input.trim()
    if (!textToSend || isLoading) return

    const userTimestamp = new Date().toISOString()
    const userMessage: MessageData = {
      id: Date.now().toString(),
      text: textToSend,
      isUser: true,
      createdAt: userTimestamp,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    if (onMessageSent) onMessageSent()

    try {
      // 스트리밍 사용
      const aiMessageId = (Date.now() + 1).toString()
      const aiMessageTimestamp = new Date().toISOString()
      // 계산 중 애니메이션을 표시하는 메시지 추가
      const loadingMessage: MessageData = {
        id: aiMessageId,
        text: '',
        isUser: false,
        sources: undefined,
        isLoading: true,
        createdAt: aiMessageTimestamp,
      }
      setMessages((prev) => [...prev, loadingMessage])

      let accumulatedText = ''
      // conversationId prop을 우선 사용하고, 없으면 ref 사용 (새 대화 시작 시 null 보장)
      let currentConversationId = conversationId || conversationIdRef.current || null
      let streamCompleted = false
      let firstTokenReceived = false

      try {
        for await (const event of sendMessageStream(textToSend, currentConversationId)) {
          if (event.type === 'start') {
            if (event.conversation_id) {
              currentConversationId = event.conversation_id
              const previousConversationId = conversationIdRef.current
              conversationIdRef.current = currentConversationId
              skipInitialLoadRef.current = true
              // 상위 컴포넌트에 conversation_id 전달 (URL 업데이트 보장)
              if (
                onConversationIdChange &&
                currentConversationId &&
                currentConversationId !== previousConversationId
              ) {
                // 즉시 URL 업데이트를 위해 콜백 호출
                onConversationIdChange(currentConversationId, { skipAutoFetch: true })
              }
            }
          } else if (event.type === 'token' && event.content) {
            accumulatedText += event.content
            // 첫 토큰이 도착하면 로딩 메시지를 실제 텍스트로 교체
            if (!firstTokenReceived) {
              firstTokenReceived = true
              const aiMessage: MessageData = {
                id: aiMessageId,
                text: accumulatedText,
                isUser: false,
                sources: undefined,
                isLoading: false,
                createdAt: aiMessageTimestamp,
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? aiMessage : msg
                )
              )
            } else {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? { ...msg, text: accumulatedText }
                    : msg
                )
              )
            }
            // 스트리밍 중에도 스크롤 (사용자가 맨 아래에 있을 때만)
            if (shouldAutoScrollRef.current) {
              requestAnimationFrame(() => {
                scrollToBottom(true)
              })
            }
          } else if (event.type === 'done') {
            streamCompleted = true
            if (event.sources) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId
                    ? { ...msg, sources: event.sources }
                    : msg
                )
              )
            }
            // 스트리밍 완료 시 로딩 상태 해제
            setIsLoading(false)
            break
          } else if (event.type === 'error') {
            streamCompleted = true
            setIsLoading(false)
            throw new Error(event.content || '스트리밍 중 오류가 발생했습니다.')
          }
        }
        
        // 스트리밍이 완료되지 않은 경우 대비
        if (!streamCompleted) {
          setIsLoading(false)
        }
      } catch (streamError) {
        setIsLoading(false)
        throw streamError
      } finally {
        // 최종적으로 로딩 상태 해제 보장
        setIsLoading(false)
      }
    } catch (error) {
      const errorMessage: MessageData = {
        id: (Date.now() + 1).toString(),
        text: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
        isUser: false,
      }
      setMessages((prev) => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col w-full transition-all duration-300 bg-transparent">
      {/* 채팅 메시지 영역 */}
      {showMessages && (
        <div className={`w-full p-4 md:p-6 space-y-4 bg-transparent ${messages.length === 0 ? 'flex flex-col items-center justify-center min-h-[40vh] md:min-h-[60vh]' : 'pb-8'}`}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto py-8 md:py-20">
              <div className="mb-4 md:mb-8">
                <div className="mx-auto h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-secondary/40 flex items-center justify-center shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                  <span className="text-2xl md:text-3xl text-foreground">✟</span>
                </div>
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 md:mb-4 text-foreground">
                첫 질문을 입력해보세요
              </h2>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                질문을 입력하면 관련 성경 본문과 함께 답변을 제공해드립니다.
              </p>
            </div>
          )}
          {messages.map((message, index) => (
            <Message 
              key={message.id} 
              message={message} 
              index={index}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 입력 영역 */}
      {showInput && (
        <form onSubmit={(e) => handleSubmit(e)} className="glass-strong p-4 md:p-5 border-t border-border/30 sticky bottom-0">
          <div className="flex space-x-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="질문을 입력하세요..."
                className="flex-1 px-4 md:px-5 py-3 md:py-3.5 glass rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 placeholder:text-muted-foreground text-foreground text-sm md:text-base font-medium min-h-[48px]"
                disabled={isLoading}
              />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 md:px-8 py-3 md:py-3.5 bg-foreground text-white rounded-xl font-semibold hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-200 text-sm md:text-base whitespace-nowrap min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              전송
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
