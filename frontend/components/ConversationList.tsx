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
  userId?: string
  onSelectConversation: (conversationId: string) => void
  selectedConversationId?: string | null
  onConversationDeleted?: () => void
  onLoadingComplete?: () => void
}

export default function ConversationList({ userId, onSelectConversation, selectedConversationId, onConversationDeleted, onLoadingComplete }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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
      const userQuery = userId ? `?user_id=${userId}` : ''
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations${userQuery}`, {
        cache: 'default',
        headers: {
          'Cache-Control': 'max-age=300',
        },
      })
      if (response.ok) {
        const data = await response.json()
        const fetchedConversations = data.conversations || []
        setAllConversations(fetchedConversations)
        filterConversations(fetchedConversations, searchQuery)
      }
    } catch (error) {
      console.error('대화 목록 조회 오류:', error)
    } finally {
      setIsLoading(false)
      if (onLoadingComplete) {
        onLoadingComplete()
      }
    }
  }

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('이 대화를 삭제하시겠습니까?')) {
      return
    }

    try {
      const userQuery = userId ? `?user_id=${userId}` : ''
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations/${conversationId}${userQuery}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
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
      const userQuery = userId ? `&user_id=${userId}` : ''
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/conversations/${conversationId}?title=${encodeURIComponent(editTitle.trim())}${userQuery}`, {
        method: 'PATCH',
      })
      
      if (response.ok) {
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

  useEffect(() => {
    const timer = setTimeout(() => {
      filterConversations(allConversations, searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, allConversations])

  useEffect(() => {
    fetchConversations()
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [userId])

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
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-full px-3 py-3 rounded-xl bg-secondary/30 animate-pulse border border-border/10"
            style={{ minHeight: '68px' }}
          >
            <div className="h-3 bg-secondary/50 rounded w-1/3 mb-2.5"></div>
            <div className="h-4 bg-secondary/50 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!isLoading && allConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 mt-10 mx-4 rounded-2xl border border-dashed border-border/30 bg-secondary/10 text-muted-foreground text-sm px-4 py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-secondary/30 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p>아직 대화 내역이 없습니다.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">새로운 질문을 시작해보세요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 검색 입력 필드 */}
      <div className="mb-4 px-3 pt-1">
        <div className="relative group">
          <div className="absolute inset-0 bg-secondary/20 rounded-xl blur-sm group-focus-within:bg-primary/5 transition-colors"></div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="대화 검색..."
            className="relative w-full px-4 py-2.5 pl-10 text-sm bg-background/50 backdrop-blur-sm border border-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:text-muted-foreground/70 transition-all shadow-sm"
          />
          <svg
            className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-secondary/80 text-muted-foreground transition-colors"
              aria-label="검색어 지우기"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 검색 결과 없음 */}
      {!isLoading && searchQuery && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm px-4 text-center">
          <p>검색 결과가 없습니다</p>
        </div>
      )}

      {/* 대화 목록 */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
        {conversations.map((conversation) => {
          const isSelected = selectedConversationId === conversation.id
          return (
          <div
            key={conversation.id}
            className={`relative w-full text-left rounded-xl transition-all duration-200 group ${
              isSelected
                ? 'bg-primary/10 border border-primary/20 shadow-sm'
                : 'hover:bg-secondary/40 border border-transparent'
            }`}
            onMouseEnter={() => setHoveredId(conversation.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {editingId === conversation.id ? (
              <form onSubmit={(e) => handleEditSave(conversation.id, e)} className="p-2 space-y-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-primary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditCancel()
                    }}
                    className="px-2.5 py-1.5 text-xs bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    저장
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => onSelectConversation(conversation.id)}
                className="w-full p-3 text-left focus:outline-none rounded-xl"
                aria-label={`대화 ${conversation.id} 열기`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isSelected ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground'}`}>
                      {formatDate(conversation.updated_at)}
                    </span>
                  </div>
                  <p className={`text-sm font-medium leading-relaxed line-clamp-2 ${
                    isSelected ? 'text-foreground' : 'text-foreground/80'
                  }`}>
                    {conversation.metadata?.title || conversation.first_message || `새로운 대화`}
                  </p>
                </div>
              </button>
            )}
            
            {/* 편집/삭제 버튼 (호버 시 표시) */}
            {editingId !== conversation.id && hoveredId === conversation.id && (
              <div className="absolute right-2 top-2 flex gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-border/20 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleEditStart(conversation, e)}
                  className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="제목 수정"
                  title="제목 수정"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => handleDelete(conversation.id, e)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="삭제"
                  title="삭제"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}