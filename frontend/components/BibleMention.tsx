'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BIBLE_BOOKS, type BibleBook } from '../lib/bibleBooks'

interface BibleMentionProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (book: string) => void
  searchQuery?: string
  position?: { top: number; left: number; placement: 'top' | 'bottom' } | null
  excludeElementRef?: React.RefObject<HTMLElement> | null
}

export default function BibleMention({ isOpen, onClose, onSelect, searchQuery = '', position, excludeElementRef }: BibleMentionProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const popupRef = useRef<HTMLDivElement>(null)

  // 검색어에 따라 필터링
  const filteredBooks = BIBLE_BOOKS.filter(book =>
    book.name.includes(searchQuery)
  )

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // 팝업 내부 클릭은 무시
      if (popupRef.current && popupRef.current.contains(target)) {
        return
      }
      // 제외할 요소(버튼) 클릭도 무시
      if (excludeElementRef?.current && excludeElementRef.current.contains(target)) {
        return
      }
      // 그 외의 외부 클릭은 팝업 닫기
      onClose()
    }

    // 충분한 지연을 두어 버튼 클릭 이벤트가 먼저 처리되도록
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [isOpen, onClose, excludeElementRef])

  // 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  // 검색어 변경 시 선택 인덱스 리셋
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredBooks.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredBooks[selectedIndex]) {
          onSelect(filteredBooks[selectedIndex].name)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredBooks, onSelect, onClose])

  if (!isOpen) return null

  // 위치에 따른 클래스 결정
  const positioningClass = position 
    ? 'fixed z-[9999]' 
    : 'absolute left-0 top-[calc(100%+8px)] z-[9999]'

  const popupContent = (
    <div
      ref={popupRef}
      className={`${positioningClass} bg-white border border-border rounded-xl shadow-[0_18px_36px_rgba(15,23,42,0.12)] overflow-hidden w-[calc(100vw-16px)] max-w-[320px] sm:min-w-[280px]`}
      style={position ? { 
        top: `${Math.max(8, Math.min(position.top, window.innerHeight - 320))}px`, 
        left: `${Math.max(8, Math.min(position.left, Math.min(window.innerWidth - 16, window.innerWidth - 320)))}px`,
        position: 'fixed',
        zIndex: 99999,
        maxWidth: `${Math.min(320, window.innerWidth - 16)}px`
      } : undefined}
    >
      <div className="max-h-[300px] overflow-y-auto">
        <div className="p-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mb-1">
            성경 선택
          </div>
          {filteredBooks.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              검색 결과가 없습니다
            </div>
          ) : (
            filteredBooks.map((book, index) => (
              <button
                key={book.name}
                ref={el => { itemRefs.current[index] = el }}
                onClick={() => onSelect(book.name)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                  index === selectedIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-foreground'
                }`}
              >
                <span className="font-medium">{book.name}</span>
                <span className={`text-xs ${
                  index === selectedIndex ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}>
                  {book.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )

  // Portal을 사용하여 document.body에 직접 렌더링
  if (typeof window !== 'undefined') {
    return createPortal(popupContent, document.body)
  }
  
  return popupContent
}

