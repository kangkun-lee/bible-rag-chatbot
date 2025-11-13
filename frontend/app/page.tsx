'use client'

import Chat from '../components/Chat'
import ChatInput from '../components/ChatInput'
import ThemeToggle from '../components/ThemeToggle'
import ConversationList from '../components/ConversationList'
import { useState, useEffect } from 'react'

export default function Home() {
  const [inputMessage, setInputMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [conversationMessages, setConversationMessages] = useState<any[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleMessageSent = (message: string) => {
    setInputMessage(message)
    setIsLoading(true)
  }

  const handleMessageReceived = () => {
    setIsLoading(false)
  }

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading)
  }

  const handleConversationIdChange = (conversationId: string | null) => {
    setSelectedConversationId(conversationId)
  }

  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations/${conversationId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setConversationMessages(data.messages || [])
      }
    } catch (error) {
      console.error('메시지 조회 오류:', error)
    }
  }

  const handleNewConversation = () => {
    setSelectedConversationId(null)
    setConversationMessages([])
    setInputMessage(null)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  const handleConversationDeleted = () => {
    // 선택된 대화가 삭제된 경우 초기화
    if (selectedConversationId) {
      setSelectedConversationId(null)
      setConversationMessages([])
    }
  }

  // 대화 선택 시 메시지 로드
  useEffect(() => {
    if (selectedConversationId) {
      handleSelectConversation(selectedConversationId)
    }
  }, [selectedConversationId])

  return (
    <main className="relative h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-background" role="main">
      {/* 스킵 링크 - 접근성 */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-foreground focus:text-white focus:rounded-lg focus:font-semibold"
      >
        메인 콘텐츠로 건너뛰기
      </a>

      {/* 모바일 메뉴 버튼 */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="md:hidden absolute top-3 left-3 z-20 inline-flex items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-sm w-11 h-11 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="사이드바 열기"
        aria-expanded={isSidebarOpen}
      >
        <svg
          className="w-5 h-5 text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 모바일 오버레이 */}
      {isSidebarOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="사이드바 닫기"
        />
      )}

      {/* 왼쪽 사이드바 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 md:w-96 flex-shrink-0 flex flex-col glass-strong border-r border-border/30 shadow-[4px_0_16px_rgba(0,0,0,0.12),8px_0_24px_rgba(0,0,0,0.08),16px_0_48px_rgba(0,0,0,0.04)] transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:flex'}`}
        role="navigation"
        aria-label="주요 메뉴"
        style={{ boxShadow: '4px 0 16px rgba(0, 0, 0, 0.12), 8px 0 24px rgba(0, 0, 0, 0.08), 16px 0 48px rgba(0, 0, 0, 0.04), inset -1px 0 0 rgba(255, 255, 255, 0.1)' }}
      >
        {/* 로고 영역 */}
        <div className="p-6 pb-4 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.12),0_3px_10px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.5)] transform-style-preserve-3d transition-all duration-300 hover:shadow-[0_10px_28px_rgba(0,0,0,0.15),0_5px_14px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.6)] hover:-translate-y-1 hover:translate-z-10 hover:rotate-3" aria-hidden="true" style={{ transformStyle: 'preserve-3d' }}>
              <span className="text-foreground font-bold text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">✟</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">성경QA</h1>
              <p className="text-xs text-muted-foreground">하나님의 말씀을 묻고 답하다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="사이드바 닫기"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 메인 메뉴 */}
        <div className="p-4 border-b border-border/30">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">메인 메뉴</h2>
          <div className="space-y-1">
            <button 
              onClick={handleNewConversation}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground hover:bg-secondary/30 transition-all duration-200 text-sm font-medium group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="새 대화 시작"
            >
              <div className="w-5 h-5 rounded-lg bg-secondary/30 flex items-center justify-center group-hover:bg-secondary/50 transition-colors">
                <svg className="w-3 h-3 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span>새 대화</span>
            </button>
            <button 
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground hover:bg-secondary/30 transition-all duration-200 text-sm font-medium group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="대화 검색"
            >
              <div className="w-5 h-5 rounded-lg bg-secondary/30 flex items-center justify-center group-hover:bg-secondary/50 transition-colors">
                <svg className="w-3 h-3 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span>대화 검색</span>
            </button>
            <button 
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground hover:bg-secondary/30 transition-all duration-200 text-sm font-medium group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="라이브러리"
            >
              <div className="w-5 h-5 rounded-lg bg-secondary/30 flex items-center justify-center group-hover:bg-secondary/50 transition-colors">
                <svg className="w-3 h-3 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span>라이브러리</span>
            </button>
          </div>
        </div>

        {/* 대화 내역 */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">대화 내역</h2>
          <ConversationList 
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversationId}
            onConversationDeleted={handleConversationDeleted}
          />
        </div>

        {/* 계정 */}
        <div className="p-4 border-t border-border/30">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground hover:bg-secondary/30 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" aria-label="내 계정">
            <div className="relative w-9 h-9 rounded-full bg-secondary/30 flex items-center justify-center text-foreground text-xs font-semibold group-hover:bg-secondary/50 transition-colors">
              <span className="relative">사용자</span>
            </div>
            <span className="text-sm font-medium">내 계정</span>
          </button>
        </div>
      </aside>

      {/* 오른쪽 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden relative pt-16 md:pt-0">

        {/* 메인 콘텐츠 - 중앙 정렬, 배경과 일체감 */}
        <div className="flex-1 flex flex-col relative z-10 min-h-0">
          {/* 상단 헤더 - 고정 */}
          <header className="flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 flex-shrink-0 glass-strong border-b border-border/30 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06),0_16px_48px_rgba(0,0,0,0.04)]" role="banner">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4">
              <div className="pl-10 md:pl-0">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                  안녕하세요, 사용자님
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="text-foreground text-lg" aria-hidden="true">✟</span>
                  성경에 대해 무엇이든 물어보세요
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-xs text-muted-foreground glass px-4 py-2 rounded-full backdrop-blur-md border border-border/50">
                  출처: <a 
                    href="https://www.bskorea.or.kr" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground transition-colors"
                    aria-label="대한성서공회 웹사이트 열기"
                  >
                    대한성서공회
                  </a>, 1961 개정 '성경전서 개역한글판'
                  <br />
                  <span className="text-[10px] text-muted-foreground">동일성유지권·성명표시권 준수</span>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* 채팅 영역 - 스크롤 가능, 중앙 정렬 */}
          <div className="flex-1 flex flex-col min-h-0">
            <div 
              className="flex-1 min-h-0 overflow-y-auto bg-background" 
              id="main-content" 
              style={{ 
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain'
              }}
            >
              <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
                <Chat 
                  initialMessage={null} 
                  externalMessage={inputMessage}
                  onMessageSent={handleMessageReceived}
                  onLoadingChange={handleLoadingChange}
                  showInput={false}
                  conversationId={selectedConversationId}
                  initialMessages={conversationMessages}
                  onConversationIdChange={handleConversationIdChange}
                />
              </div>
            </div>
            
            {/* 입력 영역 - 하단 고정 */}
            <div className="flex-shrink-0 border-t border-border/30 bg-background/95 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4">
                <ChatInput onMessageSent={handleMessageSent} isLoading={isLoading} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
