const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ChatResponse {
  answer: string
  conversation_id?: string
  sources?: Array<{
    book: string
    chapter: string
    verse: string
    content: string
  }>
}

export async function sendMessage(
  message: string,
  conversationId?: string | null
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send message: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export interface StreamEvent {
  type: 'start' | 'token' | 'done' | 'error'
  conversation_id?: string
  content?: string
  sources?: Array<{
    book: string
    chapter: string
    verse: string
    content: string
  }>
}

export async function* sendMessageStream(
  message: string,
  conversationId?: string | null
): AsyncGenerator<StreamEvent, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    
    // 503 에러 (서비스 과부하) 처리
    if (response.status === 503) {
      const errorMessage = errorText.includes('overloaded') 
        ? 'AI 모델이 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
        : '서비스가 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.'
      throw new Error(errorMessage)
    }
    
    throw new Error(`Failed to start stream: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No response body')
  }

  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        // 스트리밍이 완료되면 남은 버퍼 처리
        if (buffer.trim()) {
          const lines = buffer.split('\n')
          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                yield data
              } catch (e) {
                // SSE 데이터 파싱 실패 시 무시
              }
            }
          }
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim() && line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            yield data
          } catch (e) {
            // SSE 데이터 파싱 실패 시 무시
          }
        }
      }
    }
  } finally {
    // 리더 정리
    reader.releaseLock()
  }
}

export async function healthCheck(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  
  if (!response.ok) {
    throw new Error('Health check failed')
  }

  return response.json()
}

