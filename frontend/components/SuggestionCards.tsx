'use client'

interface SuggestionCard {
  id: string
  title: string
  description: string
}

const suggestions: SuggestionCard[] = [
  {
    id: '1',
    title: '창세기 1:1',
    description: '히브리어 단어별 의미 설명'
  },
  {
    id: '2',
    title: '요한복음 3:16',
    description: '개역한글/ESV/NIV 번역 비교'
  },
  {
    id: '3',
    title: '시편 23편',
    description: '고난 상황에 주는 적용'
  },
  {
    id: '4',
    title: '로마서 8장',
    description: '성령의 인도하심과 교차참조'
  },
  {
    id: '5',
    title: '마태복음 5장',
    description: '산상수훈의 구조와 의미'
  },
  {
    id: '6',
    title: '고린도전서 13장',
    description: '사랑의 정의와 실제 적용'
  }
]

interface SuggestionCardsProps {
  onSelect: (suggestion: string) => void
}

export default function SuggestionCards({ onSelect }: SuggestionCardsProps) {
  return (
    <div className="w-full">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.title)}
            className="flex-shrink-0 glass px-5 py-4 rounded-xl hover:bg-secondary/30 transition-all duration-200 text-left min-w-[200px] md:min-w-[220px] group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={`${suggestion.title}: ${suggestion.description}`}
          >
            <div className="relative">
              <h4 className="font-semibold text-foreground text-sm mb-1.5 transition-colors flex items-center gap-2">
                <span className="text-foreground" aria-hidden="true">✧</span>
                {suggestion.title}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

