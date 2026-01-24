'use client'

import Chat from '../../../components/Chat'
import ChatInput from '../../../components/ChatInput'
import ThemeToggle from '../../../components/ThemeToggle'
import ConversationList from '../../../components/ConversationList'
import LoadingScreen from '../../../components/LoadingScreen'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import type { Profile } from '../../../lib/profiles'
import { resolveProfile } from '../../../lib/profiles'
import { getProfileFromStorage, saveProfile } from '../../../lib/profileStorage'

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const conversationIdFromUrl = params?.id as string | undefined
  
  const [inputMessage, setInputMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversationIdFromUrl || null)
  const [conversationMessages, setConversationMessages] = useState<any[]>([])
  // 초기 상태: SSR과 클라이언트 일치를 위해 항상 false로 시작
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [conversationListLoaded, setConversationListLoaded] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const skipAutoFetchRef = useRef(false)
  const searchParams = useSearchParams()

  // URL의 conversation ID와 상태 동기화
  useEffect(() => {
    if (conversationIdFromUrl && conversationIdFromUrl !== selectedConversationId) {
      // URL에 ID가 있으면 상태 업데이트
      setSelectedConversationId(conversationIdFromUrl)
    } else if (!conversationIdFromUrl) {
      // URL에 ID가 없으면 (루트 페이지) 상태도 null로 초기화 (새 대화 시작)
      if (selectedConversationId !== null) {
        setSelectedConversationId(null)
      }
    }
  }, [conversationIdFromUrl, selectedConversationId, router])

  useEffect(() => {
    const resolved = resolveProfile(searchParams.get('user')) || getProfileFromStorage()
    if (!resolved) {
      router.replace('/')
      return
    }
    saveProfile(resolved)
    setSelectedProfile(resolved)
  }, [router, searchParams])

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
      router.push(newUrl)
    }
  }

  const handleSelectConversation = async (conversationId: string) => {
    if (!selectedProfile) return
    skipAutoFetchRef.current = true
    setSelectedConversationId(conversationId)
    // URL 업데이트 (Vercel/Render 배포 환경 대응)
    const userQuery = `?user=${selectedProfile.key}`
    const newUrl = `/chat/${conversationId}${userQuery}`
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== newUrl) {
      router.push(newUrl)
    }
    
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
    // 메시지 로딩 시작
    setConversationMessages([])
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations/${conversationId}/messages?user_id=${selectedProfile.id}`, {
        // 캐싱 헤더 추가
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
    router.push(`/chat${userQuery}`, { scroll: false })
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  const handleConversationDeleted = () => {
    // 선택된 대화가 삭제된 경우 초기화
    if (selectedConversationId) {
      setSelectedConversationId(null)
      setConversationMessages([])
      const userQuery = selectedProfile ? `?user=${selectedProfile.key}` : ''
      router.push(`/chat${userQuery}`, { scroll: false })
    }
  }

  // 초기 로딩 완료 처리
  useEffect(() => {
    if (conversationListLoaded) {
      // ConversationList 로딩 완료 후 짧은 지연으로 부드러운 전환
      const timer = setTimeout(() => {
        setIsInitialLoading(false)
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [conversationListLoaded])

  // 대화 선택 시 메시지 로드
  useEffect(() => {
    if (!selectedConversationId || selectedConversationId !== conversationIdFromUrl) {
      return
    }
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false
      return
    }
    handleSelectConversation(selectedConversationId)
  }, [selectedConversationId, conversationIdFromUrl])

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
      {isInitialLoading && <LoadingScreen message="성경QA를 준비하는 중..." />}
      <main
        className="relative w-full h-[calc(var(--vh,1vh)*100)] flex flex-col md:flex-row bg-background overflow-hidden"
        role="main"
        suppressHydrationWarning
        style={{ 
          height: 'calc(var(--vh, 1vh) * 100)',
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          position: 'relative',
          opacity: isInitialLoading ? 0 : 1,
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
        className={`md:hidden fixed top-3 left-3 z-20 inline-flex items-center justify-center rounded-full bg-background/90 border border-border/40 shadow-sm w-12 h-12 touch-manipulation focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-opacity duration-200 ${
          isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="사이드바 열기"
        aria-expanded={isSidebarOpen}
        style={{ 
          minWidth: '48px', 
          minHeight: '48px',
          zIndex: isSidebarOpen ? 50 : 20  // 사이드바(z-40)보다 높게 설정
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
          className="md:hidden fixed inset-0 bg-black/30"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="사이드바 닫기"
          style={{ zIndex: 35 }}
        />
      )}

        {/* 왼쪽 사이드바 */}
        <aside
          className={`${isDesktop ? 'static' : 'fixed'} ${isDesktop ? '' : 'inset-y-0'} left-0 ${isDesktop ? 'w-96' : 'w-[90vw] max-w-sm'} sm:w-80 md:w-96 flex-shrink-0 flex flex-col glass-strong border-r border-border/30 transform-gpu transition-transform duration-300 ease-out ${sidebarTranslateClass} md:static md:flex md:translate-x-0 z-40`}
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
          }}
        >
          {/* 로고 영역 */}
          <div className="flex-shrink-0 pt-8 pb-6 px-6 border-b border-border/10 flex items-center justify-between">
            <button
              onClick={() => {
                handleNewConversation()
              }}
              className="flex items-center gap-3.5 group focus:outline-none"
              aria-label="홈으로 이동"
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300 ring-1 ring-border/20">
                <span className="text-foreground font-serif font-bold text-xl drop-shadow-sm">✟</span>
              </div>
              <div className="flex flex-col items-start">
                <h1 className="text-lg font-bold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">성경QA</h1>
                <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase opacity-80">Divine Wisdom</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-full text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 메인 메뉴 */}
          <div className="flex-shrink-0 p-4 pb-2">
            <button 
              onClick={handleNewConversation}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
              <div className="relative flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-background/50 backdrop-blur-md border border-border/20 group-hover:bg-background/80 transition-all duration-300 shadow-sm group-hover:shadow-md">
                <svg className="w-4 h-4 text-primary group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-semibold text-foreground tracking-wide">새로운 대화 시작</span>
              </div>
            </button>
          </div>

          {/* 대화 내역 */}
          <div className="flex-1 overflow-y-auto min-h-0 px-2 py-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30">
            <div className="px-4 py-2 mb-2">
               <h2 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">History</h2>
            </div>
            <ConversationList 
              userId={selectedProfile?.id}
              onSelectConversation={handleSelectConversation}
              selectedConversationId={selectedConversationId}
              onConversationDeleted={handleConversationDeleted}
              onLoadingComplete={() => setConversationListLoaded(true)}
            />
          </div>

          {/* 계정 - 하단 고정 */}
          <div className="flex-shrink-0 p-4 border-t border-border/10 bg-gradient-to-t from-background/50 to-transparent">
            <button
              onClick={() => {
                if (window.confirm('다른 프로필로 변경하시겠습니까?')) {
                  localStorage.removeItem('bibleqa.profile')
                  router.push('/')
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/40 transition-all duration-300 group border border-transparent hover:border-border/10"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center ring-1 ring-border/20 group-hover:ring-primary/30 transition-all">
                <span className="text-xs font-bold text-foreground">{selectedProfile?.name?.[0] || 'U'}</span>
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground truncate w-full text-left group-hover:text-primary transition-colors">
                  {selectedProfile?.name ?? '사용자'}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 group-hover:text-muted-foreground/80">
                  프로필 전환
                </span>
              </div>
              <svg className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
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
          <header className="flex items-center justify-between px-4 sm:px-6 md:px-8 pt-2 pb-3 sm:pb-4 md:py-6 flex-shrink-0 glass-strong border-b border-border/30 shadow-[0_4px_12px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06),0_16px_48px_rgba(0,0,0,0.04)]" role="banner" style={{ paddingTop: isDesktop ? undefined : '64px' }}>
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-2 sm:gap-4">
              <div className={`${isDesktop ? '' : 'pl-12 sm:pl-14'} md:pl-0 flex-1 min-w-0`}>
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-1 sm:mb-1.5 truncate">
                    안녕하세요, {selectedProfile?.name ?? '사용자'}님
                  </h2>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <span className="text-foreground text-base sm:text-lg" aria-hidden="true">✟</span>
                  <span className="truncate">성경에 대해 무엇이든 물어보세요</span>
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="hidden lg:block text-xs text-muted-foreground glass px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-md border border-border/50">
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
          <div 
            className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background" 
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
              className="flex-1 bg-background overflow-y-auto w-full"
              style={{ 
                minHeight: 0,
                flex: '1 1 0%',
                scrollBehavior: 'smooth',
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
            <div className="flex-shrink-0 border-t border-border/30 bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
              <div className="max-w-4xl mx-auto w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4">
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
