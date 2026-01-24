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
  userId?: string | null
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

export default function Chat({ initialMessage, onMessageSent, onLoadingChange, showMessages = true, showInput = true, externalMessage, conversationId, userId, initialMessages, onConversationIdChange }: ChatProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(conversationId || null)
  const processedMessagesRef = useRef<Set<string>>(new Set())
  const skipInitialLoadRef = useRef(false)
  const lastMessageSentRef = useRef<number>(0) // 마지막으로 메시지를 보낸 시간 (타임스탬프)
  const shouldAutoScrollRef = useRef(true)

  // isLoading 상태 변경 시 부모에게 알림
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading)
    }
  }, [isLoading, onLoadingChange])

  // 대화 ID 변경 시 메시지 초기화 및 로드
  useEffect(() => {
    const previousConversationId = conversationIdRef.current
    conversationIdRef.current = conversationId || null

    if (!conversationId) {
      if (isLoading || Date.now() - lastMessageSentRef.current < 2000) {
        return
      }
      if (previousConversationId !== null || messages.length > 0) {
        setMessages([])
        setInput('')
        processedMessagesRef.current.clear()
      }
      skipInitialLoadRef.current = false
      return
    }

    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false
      return
    }

    if (Date.now() - lastMessageSentRef.current < 2000) {
      return
    }

    if (isLoading) {
      return
    }

    if (conversationId) {
      if (initialMessages && initialMessages.length > 0) {
        const formattedMessages: MessageData[] = initialMessages.map((msg) => ({
          id: msg.id,
          text: msg.content,
          isUser: msg.role === 'user',
          createdAt: msg.created_at,
          sources: msg.sources || undefined,
        }))
        setMessages(formattedMessages)
      } else if (previousConversationId !== conversationId) {
        setMessages([])
      }
    } else {
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
          const aiMessageId = (Date.now() + 1).toString()
          const aiMessageTimestamp = new Date().toISOString()
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
          let currentConversationId = conversationId || conversationIdRef.current || null
          let streamCompleted = false
          let firstTokenReceived = false

          try {
            for await (const event of sendMessageStream(initialMessage, currentConversationId, userId)) {
              if (event.type === 'start') {
                if (event.conversation_id) {
                  currentConversationId = event.conversation_id
                  const previousConversationId = conversationIdRef.current
                  conversationIdRef.current = currentConversationId
                  skipInitialLoadRef.current = true
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
                setIsLoading(false)
                if (onMessageSent) onMessageSent()
                break
              } else if (event.type === 'error') {
                streamCompleted = true
                let errorText = '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.'
                if (event.content) {
                  if (event.content.includes('overloaded') || event.content.includes('503') || event.content.includes('The model is overloaded')) {
                    errorText = 'AI 모델이 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
                  } else if (event.content.includes('처리 중 오류가 발생했습니다')) {
                    errorText = event.content
                  }
                }
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

            if (!streamCompleted) {
              setIsLoading(false)
            }
          } catch (streamError) {
            setIsLoading(false)
            throw streamError
          } finally {
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
          lastMessageSentRef.current = Date.now()
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
        lastMessageSentRef.current = Date.now()

        try {
          const aiMessageId = (Date.now() + 1).toString()
          const aiMessageTimestamp = new Date().toISOString()
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
          let currentConversationId = conversationId || conversationIdRef.current || null
          let streamCompleted = false
          let firstTokenReceived = false

          try {
            for await (const event of sendMessageStream(externalMessage, currentConversationId, userId)) {
              if (event.type === 'start') {
                if (event.conversation_id) {
                  currentConversationId = event.conversation_id
                  const previousConversationId = conversationIdRef.current
                  conversationIdRef.current = currentConversationId
                  skipInitialLoadRef.current = true
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
                setIsLoading(false)
                break
              } else if (event.type === 'error') {
                streamCompleted = true
                setIsLoading(false)
                break
              }
            }

            if (!streamCompleted) {
              setIsLoading(false)
            }
          } catch (streamError) {
            setIsLoading(false)
            throw streamError
          } finally {
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

  const getScrollContainer = (): HTMLElement | null => {
    const byId = document.getElementById('main-content')
    if (byId) {
      return byId
    }
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
      const scrollHeight = container.scrollHeight
      container.scrollTop = scrollHeight
      requestAnimationFrame(() => {
        container.scrollTop = scrollHeight
        setTimeout(() => {
          container.scrollTo({
            top: scrollHeight,
            behavior: 'smooth'
          })
        }, 10)
      })
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

  useEffect(() => {
    const container = getScrollContainer()
    if (!container) {
      return
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScrollRef.current = isNearBottom
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const container = getScrollContainer()
    if (container) {
      shouldAutoScrollRef.current = true
      scrollToBottom(true)
    }
  }, [])

  useEffect(() => {
    const container = getScrollContainer()
    if (container && messages.length === 0) {
      container.scrollTop = 0
      shouldAutoScrollRef.current = true
    }
  }, [messages.length])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      const container = getScrollContainer()
      if (container) {
        container.scrollTop = container.scrollHeight
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight
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
    lastMessageSentRef.current = Date.now()
    if (onMessageSent) onMessageSent()

    try {
      const aiMessageId = (Date.now() + 1).toString()
      const aiMessageTimestamp = new Date().toISOString()
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
      let currentConversationId = conversationId || conversationIdRef.current || null
      let streamCompleted = false
      let firstTokenReceived = false

      try {
        for await (const event of sendMessageStream(textToSend, currentConversationId, userId)) {
          if (event.type === 'start') {
            if (event.conversation_id) {
              currentConversationId = event.conversation_id
              const previousConversationId = conversationIdRef.current
              conversationIdRef.current = currentConversationId
              skipInitialLoadRef.current = true
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
            setIsLoading(false)
            break
          } else if (event.type === 'error') {
            streamCompleted = true
            setIsLoading(false)
            throw new Error(event.content || '스트리밍 중 오류가 발생했습니다.')
          }
        }

        if (!streamCompleted) {
          setIsLoading(false)
        }
      } catch (streamError) {
        setIsLoading(false)
        throw streamError
      } finally {
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
        <div className={`w-full p-4 md:p-6 space-y-6 bg-transparent ${messages.length === 0 ? 'flex flex-col items-center justify-center min-h-[40vh] md:min-h-[60vh]' : 'pb-8'}`}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto py-8 md:py-20 animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-6 md:mb-8 relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                <div className="relative mx-auto h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-gradient-to-br from-background to-secondary flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border/50">
                  <span className="text-3xl md:text-4xl text-primary drop-shadow-sm">✟</span>
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4 text-foreground tracking-tight">
                무엇이 궁금하신가요?
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg font-medium">
                성경 말씀을 통해 지혜와 위로를 찾아보세요.<br/>
                관련된 구절과 함께 답변해 드립니다.
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
          <div ref={messagesEndRef} className="h-4" />
        </div>
      )}

      {/* 입력 영역 */}
      {showInput && (
        <div className="sticky bottom-0 z-10 w-full bg-gradient-to-t from-background via-background to-transparent pb-4 pt-10 px-4 md:px-6">
          <form onSubmit={(e) => handleSubmit(e)}>
            {/* Input is now self-contained in ChatInput component, but we need to match the structure if we use the component */}
            {/* Since ChatInput is used in page.tsx, we don't strictly need it here if showInput is false in page.tsx */}
            {/* However, the original code had it here. Let's keep the cleaner layout structure but defer to the page's input if needed */}
          </form>
        </div>
      )}
    </div>
  )
}