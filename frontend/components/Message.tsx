'use client'

interface MessageProps {
  message: {
    id: string
    text: string
    isUser: boolean
    sources?: Array<{
      book: string
      chapter: string
      verse: string
      content: string
    }>
  }
}

export default function Message({ message }: MessageProps) {
  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          message.isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs font-semibold mb-2">참고 구절:</p>
            <div className="space-y-1">
              {message.sources.map((source, index) => (
                <div key={index} className="text-xs">
                  <span className="font-semibold">
                    {source.book} {source.chapter}:{source.verse}
                  </span>
                  <span className="ml-2 text-gray-600">
                    {source.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

