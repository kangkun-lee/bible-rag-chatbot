'use client'

import { useEffect, useState } from 'react'

interface Conversation {
  id: string
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
  first_message?: string
}

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void
  selectedConversationId?: string | null
  onConversationDeleted?: () => void
}

export default function ConversationList({ onSelectConversation, selectedConversationId, onConversationDeleted }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allConversations, setAllConversations] = useState<Conversation[]>([]) // 전체 대화 목록 (검색용)
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 검색어로 대화 필터링
  const filterConversations = (conversationsToFilter: Conversation[], query: string) => {
    if (!query.trim()) {
      setConversations(conversationsToFilter)
      return
    }

    const lowerQuery = query.toLowerCase().trim()
    const filtered = conversationsToFilter.filter(conv => {
      const title = (conv.metadata?.title || '').toLowerCase()
      const firstMessage = (conv.first_message || '').toLowerCase()
      return title.includes(lowerQuery) || firstMessage.includes(lowerQuery)
    })
    setConversations(filtered)
  }

  const fetchConversations = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations`, {
        // 캐싱 헤더 추가 (5분간 캐시)
        cache: 'default',
        headers: {
          'Cache-Control': 'max-age=300',
        },
      })
      if (response.ok) {
        const data = await response.json()
        const fetchedConversations = data.conversations || []
        setAllConversations(fetchedConversations)
        // 검색어가 있으면 필터링, 없으면 전체 표시
        filterConversations(fetchedConversations, searchQuery)
      }
    } catch (error) {
      console.error('대화 목록 조회 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 대화를 삭제하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        // 전체 목록과 필터링된 목록 모두 업데이트
        setAllConversations(prev => prev.filter(conv => conv.id !== conversationId))
        setConversations(prev => prev.filter(conv => conv.id !== conversationId))
        if (onConversationDeleted) {
          onConversationDeleted()
        }
      } else {
        alert('대화 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('대화 삭제 오류:', error)
      alert('대화 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleEditStart = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conversation.id)
    setEditTitle(conversation.metadata?.title || conversation.first_message || '')
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const handleEditSave = async (conversationId: string, e: React.FormEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!editTitle.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations/${conversationId}?title=${encodeURIComponent(editTitle.trim())}`, {
        method: 'PATCH',
      })
      
      if (response.ok) {
        // 전체 목록과 필터링된 목록 모두 업데이트
        const updateConversation = (conv: Conversation) => 
          conv.id === conversationId 
            ? { ...conv, metadata: { ...conv.metadata, title: editTitle.trim() } }
            : conv
        
        setAllConversations(prev => prev.map(updateConversation))
        setConversations(prev => prev.map(updateConversation))
        setEditingId(null)
        setEditTitle('')
      } else {
        alert('대화 제목 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('대화 제목 수정 오류:', error)
      alert('대화 제목 수정 중 오류가 발생했습니다.')
    }
  }

  // 검색어 변경 시 필터링 (debounce 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      filterConversations(allConversations, searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery, allConversations])

  useEffect(() => {
    // 초기 로드 시 대화 목록 조회
    fetchConversations()
    
    // 페이지가 다시 포커스를 받았을 때만 갱신 (다른 탭에서 대화를 생성했을 수 있음)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60))
        return minutes <= 0 ? '방금 전' : `${minutes}분 전`
      }
      return `${hours}시간 전`
    } else if (days === 1) {
      return '어제'
    } else if (days < 7) {
      return `${days}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-full px-3 py-2.5 rounded-xl bg-secondary/20 animate-pulse"
            style={{ minHeight: '60px' }}
          >
            <div className="h-3 bg-secondary/40 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-secondary/40 rounded w-full"></div>
            <div className="h-4 bg-secondary/40 rounded w-3/4 mt-1"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!isLoading && allConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-2xl border border-dashed border-border/70 bg-secondary/20 text-muted-foreground text-sm px-4 py-6">
        아직 저장된 대화가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* 검색 입력 필드 */}
      <div className="mb-3 px-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="대화 검색..."
            className="w-full px-3 py-2 pl-9 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 placeholder:text-muted-foreground"
          />
          <svg
            className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 p-1 rounded hover:bg-secondary/50 transition-colors"
              aria-label="검색어 지우기"
            >
              <svg
                className="w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-1.5 text-xs text-muted-foreground px-1">
            {conversations.length}개의 대화를 찾았습니다
          </p>
        )}
      </div>

      {/* 검색 결과가 없을 때 */}
      {!isLoading && searchQuery && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-border/70 bg-secondary/20 text-muted-foreground text-sm px-4">
          <svg
            className="w-8 h-8 mb-2 text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p>검색 결과가 없습니다</p>
        </div>
      )}

      {/* 대화 목록 */}
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`relative w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
            selectedConversationId === conversation.id
              ? 'bg-primary/10 border border-primary/30'
              : 'hover:bg-secondary/30 border border-transparent'
          }`}
          onMouseEnter={() => setHoveredId(conversation.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {editingId === conversation.id ? (
            <form onSubmit={(e) => handleEditSave(conversation.id, e)} className="space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditCancel()
                  }}
                  className="px-2 py-1 text-xs bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => onSelectConversation(conversation.id)}
              className="w-full text-left focus:outline-none"
              aria-label={`대화 ${conversation.id} 열기`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <svg 
                      className="w-4 h-4 text-muted-foreground flex-shrink-0" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-xs text-muted-foreground truncate">
                      {formatDate(conversation.updated_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">
                    {conversation.metadata?.title || conversation.first_message || `대화 ${conversation.id.slice(0, 8)}...`}
                  </p>
                </div>
              </div>
            </button>
          )}
          
          {/* 편집/삭제 버튼 (호버 시 표시) */}
          {editingId !== conversation.id && hoveredId === conversation.id && (
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={(e) => handleEditStart(conversation, e)}
                className="p-1.5 rounded hover:bg-secondary/50 transition-colors"
                aria-label="대화 제목 수정"
                title="제목 수정"
              >
                <svg 
                  className="w-3.5 h-3.5 text-muted-foreground" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => handleDelete(conversation.id, e)}
                className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
                aria-label="대화 삭제"
                title="삭제"
              >
                <svg 
                  className="w-3.5 h-3.5 text-destructive" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

