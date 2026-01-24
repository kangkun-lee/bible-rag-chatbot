'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Chat from '../../components/Chat'
import ChatInput from '../../components/ChatInput'
import ThemeToggle from '../../components/ThemeToggle'
import ConversationList from '../../components/ConversationList'
import type { Profile } from '../../lib/profiles'
import { getProfileFromStorage, getProfileFromUrl, saveProfile } from '../../lib/profileStorage'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ChatHome() {
  const router = useRouter()
  const [inputMessage, setInputMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [conversationMessages, setConversationMessages] = useState<any[]>([])
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  // 초기 상태: SSR과 클라이언트 일치를 위해 항상 false로 시작
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const skipAutoFetchRef = useRef(false)

  useEffect(() => {
    const fromUrl = getProfileFromUrl()
    const fromStorage = getProfileFromStorage()
    const resolved = fromUrl || fromStorage
    if (!resolved) {
      router.replace('/')
      return
    }
    saveProfile(resolved)
    setSelectedProfile(resolved)
  }, [router])

  // 모바일에서 사이드바는 기본적으로 닫혀있어야 함
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(min-width: 768px)')

      const applyMatch = (matches: boolean) => {
        setIsDesktop(matches)
        setIsSidebarOpen(matches)
      }

      // 초기 실행
      applyMatch(mediaQuery.matches)

      const listener = (event: MediaQueryListEvent) => applyMatch(event.matches)
      mediaQuery.addEventListener('change', listener)

      return () => {
        mediaQuery.removeEventListener('change', listener)
      }
    }
  }, [])

  // 사이드바 상태 변경 디버깅 및 강제 업데이트
  const shouldShowSidebar = isDesktop || isSidebarOpen
  const sidebarTranslateClass = shouldShowSidebar ? 'translate-x-0' : '-translate-x-full'

  // 모바일 100vh 이슈 대응을 위한 CSS 변수 설정
  useEffect(() => {
    if (typeof window === 'undefined') return

    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    setViewportHeight()
    window.addEventListener('resize', setViewportHeight)
    return () => window.removeEventListener('resize', setViewportHeight)
  }, [])

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

  const handleConversationIdChange = (conversationId: string | null, options?: { skipAutoFetch?: boolean }) => {
    if (options?.skipAutoFetch) {
      skipAutoFetchRef.current = true
    }
    setSelectedConversationId(conversationId)
    const userQuery = selectedProfile ? `?user=${selectedProfile.key}` : ''
    const newUrl = conversationId
      ? `/chat/${conversationId}${userQuery}`
      : `/chat${userQuery}`
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== newUrl) {
      window.history.pushState({ path: newUrl }, '', newUrl)
    }
  }

  const handleSelectConversation = async (conversationId: string) => {
    if (!selectedProfile) return
    skipAutoFetchRef.current = true
    setSelectedConversationId(conversationId)
    const userQuery = `?user=${selectedProfile.key}`
    const newUrl = `/chat/${conversationId}${userQuery}`
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== newUrl) {
      window.history.pushState({ path: newUrl }, '', newUrl)
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
    setConversationMessages([])
    try {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages?user_id=${selectedProfile.id}`, {
        cache: 'default',
        headers: {
          'Cache-Control': 'max-age=300',
        },
      })
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
    const userQuery = selectedProfile ? `?user=${selectedProfile.key}` : ''
    const newUrl = `/chat${userQuery}`
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== newUrl) {
      window.history.pushState({ path: newUrl }, '', newUrl)
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  const handleConversationDeleted = () => {
    if (selectedConversationId) {
      setSelectedConversationId(null)
      setConversationMessages([])
      const userQuery = selectedProfile ? `?user=${selectedProfile.key}` : ''
      const newUrl = `/chat${userQuery}`
      if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== newUrl) {
        window.history.pushState({ path: newUrl }, '', newUrl)
      }
    }
  }

  // 대화 선택 시 메시지 로드
  useEffect(() => {
    if (!selectedConversationId) {
      return
    }
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false
      return
    }
    handleSelectConversation(selectedConversationId)
  }, [selectedConversationId])

  // Escape 키로 사이드바 닫기 (모바일)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen && !isDesktop) {
        setIsSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isSidebarOpen, isDesktop])

  if (!selectedProfile) return null

  return (
    <>
      <main
        className="relative w-full h-[calc(var(--vh,1vh)*100)] flex flex-col md:flex-row bg-background overflow-hidden"
        role="main"
        suppressHydrationWarning
        style={{
          height: 'calc(var(--vh, 1vh) * 100)',
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          position: 'relative',
          transition: 'opacity 0.3s ease-in-out'
        }}
      >
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
          onClick={() => {
            setIsSidebarOpen((prev) => !prev)
          }}
          className={`md:hidden fixed top-3 left-3 z-20 inline-flex items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-sm w-12 h-12 touch-manipulation focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          aria-label="사이드바 열기"
          aria-expanded={isSidebarOpen}
          style={{
            minWidth: '48px',
            minHeight: '48px',
            zIndex: isSidebarOpen ? 50 : 20
          }}
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

        {/* 모바일 오버레이 - 사이드바 뒤에만 표시 */}
        {isSidebarOpen && !isDesktop && (
          <button
            type="button"
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="사이드바 닫기"
            style={{ zIndex: 35 }}
          />
        )}

        {/* 왼쪽 사이드바 - Holy/Premium Aesthetic */}
        <aside
          className={`${isDesktop ? 'static' : 'fixed'} ${isDesktop ? '' : 'inset-y-0'} left-0 ${isDesktop ? 'w-80' : 'w-[85vw] max-w-sm'} flex-shrink-0 flex flex-col glass-strong border-r border-border/30 transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${sidebarTranslateClass} md:static md:flex md:translate-x-0`}
          role="navigation"
          aria-label="주요 메뉴"
          data-sidebar-open={isSidebarOpen}
          data-is-desktop={isDesktop}
          style={{
            zIndex: isDesktop ? 0 : 40,
            display: 'flex',
            flexDirection: 'column',
            height: isDesktop ? '100%' : 'calc(var(--vh, 1vh) * 100)',
            ...(isDesktop ? {} : {
              position: 'fixed',
              top: 0,
              bottom: 0,
              left: 0
            }),
            overflow: 'hidden',
            willChange: !isDesktop ? 'transform' : 'auto'
          }}
        >
          {/* 로고 영역 */}
          <div className="flex-shrink-0 px-6 pt-8 pb-6 border-b border-border/10 bg-gradient-to-b from-background/50 to-transparent">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleNewConversation}
                className="group flex items-center gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                aria-label="홈으로 이동"
              >
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner overflow-hidden border border-white/10 group-hover:scale-105 transition-transform duration-300">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-foreground text-xl font-serif drop-shadow-sm">✟</span>
                </div>
                <div className="flex flex-col items-start">
                  <h1 className="text-lg font-bold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">성경QA</h1>
                  <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground/70">Divine Wisdom</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50 text-muted-foreground transition-colors"
                aria-label="사이드바 닫기"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleNewConversation}
              className="w-full group relative flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:shadow-lg hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              aria-label="새 대화 시작"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>새로운 질문하기</span>
            </button>
          </div>

          {/* 대화 내역 */}
          <div className="flex-1 overflow-y-auto px-3 py-4 min-h-0 custom-scrollbar">
            <div className="px-2 mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">Recent Chats</h2>
            </div>
            <ConversationList
              userId={selectedProfile?.id}
              onSelectConversation={handleSelectConversation}
              selectedConversationId={selectedConversationId}
              onConversationDeleted={handleConversationDeleted}
            />
          </div>

          {/* 계정 - 하단 고정 */}
          <div className="flex-shrink-0 p-4 border-t border-border/10 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-md">
            <button
              onClick={() => {
                if (window.confirm('다른 프로필로 변경하시겠습니까?')) {
                  localStorage.removeItem('bibleqa.profile')
                  router.push('/')
                }
              }}
              className="w-full group flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-all duration-200 border border-transparent hover:border-border/20"
              aria-label="프로필 변경"
            >
              <div 
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-background group-hover:scale-105 transition-transform"
                style={{ background: selectedProfile?.gradient || 'var(--primary)' }}
              >
                {selectedProfile?.name?.slice(0, 1) || 'U'}
              </div>
              
              <div className="flex-1 flex flex-col items-start min-w-0">
                <span className="text-sm font-semibold text-foreground/90 truncate w-full text-left group-hover:text-primary transition-colors">
                  {selectedProfile?.name ?? '사용자'}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 group-hover:text-foreground/70 transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  프로필 변경
                </span>
              </div>
              
              <div className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </aside>

        {/* 오른쪽 메인 영역 */}
        <div
          className="flex-1 flex flex-col relative w-full md:ml-0 bg-background"
          style={{
            zIndex: isDesktop ? 'auto' : 1,
            height: isDesktop ? '100%' : 'calc(var(--vh, 1vh) * 100)',
            minHeight: isDesktop ? 0 : 'calc(var(--vh, 1vh) * 100)',
            position: 'relative',
            overflow: 'hidden',
            flex: '1 1 0%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 메인 콘텐츠 - 중앙 정렬, 배경과 일체감 */}
          <div
            className="flex-1 flex flex-col relative w-full"
            style={{
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 0%',
              width: '100%',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            {/* 상단 헤더 - 고정 */}
            <header className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-4 flex-shrink-0 bg-background/80 backdrop-blur-md border-b border-border/30 z-10" role="banner" style={{ paddingTop: isDesktop ? undefined : '64px' }}>
              <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-2 sm:gap-4">
                <div className={`${isDesktop ? '' : 'pl-12'} flex-1 min-w-0 transition-all duration-300`}>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight mb-0.5 truncate flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                    안녕하세요, {selectedProfile?.name ?? '사용자'}님
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    <span className="text-primary/70">✟</span>
                    <span>오늘도 하나님의 말씀을 묵상해보세요</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground/70 bg-secondary/30 px-3 py-1.5 rounded-full border border-border/20">
                    <span>대한성서공회 (1961)</span>
                    <span className="w-0.5 h-2.5 bg-border/50"></span>
                    <a
                      href="https://www.bskorea.or.kr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors font-medium"
                    >
                      출처 확인
                    </a>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </header>

            {/* 채팅 영역 - 스크롤 가능, 중앙 정렬 */}
            <div
              className="flex-1 flex flex-col overflow-hidden min-h-0 bg-gradient-to-b from-background to-secondary/10"
              style={{
                minHeight: 0,
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%'
              }}
            >
              <div
                id="main-content"
                data-scroll-container="chat"
                className="flex-1 bg-transparent overflow-y-auto w-full scroll-smooth"
                style={{
                  minHeight: 0,
                  flex: '1 1 0%',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  position: 'relative',
                  touchAction: 'pan-y',
                  width: '100%'
                }}
              >
                <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6">
                  <Chat
                    userId={selectedProfile?.id}
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
              <div className="flex-shrink-0 border-t border-border/10 bg-background/80 backdrop-blur-xl safe-area-inset-bottom z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.02)]">
                <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 md:px-6 py-4 sm:py-5">
                  <ChatInput onMessageSent={handleMessageSent} isLoading={isLoading} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}