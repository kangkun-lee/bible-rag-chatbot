const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// API URL 확인 및 경고
if (typeof window !== 'undefined') {
  console.log('API Base URL:', API_BASE_URL)
  
  // 프로덕션 환경에서 localhost를 사용하는 경우 경고
  if (API_BASE_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    console.error('⚠️ NEXT_PUBLIC_API_URL이 설정되지 않았습니다! Vercel 환경변수를 확인하세요.')
    console.error('현재 사용 중인 URL:', API_BASE_URL)
  }
  
  // Vercel 도메인으로 요청이 가는 경우 경고
  if (API_BASE_URL.includes(window.location.hostname) && !API_BASE_URL.includes('localhost')) {
    console.error('⚠️ API 요청이 프론트엔드 도메인으로 가고 있습니다!')
    console.error('NEXT_PUBLIC_API_URL을 Render 백엔드 URL로 설정하세요.')
  }
}

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
    console.error('API Error:', {
      status: response.status,
      statusText: response.statusText,
      url: `${API_BASE_URL}/api/chat`,
      error: errorText
    })
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
    console.error('Stream API Error:', {
      status: response.status,
      statusText: response.statusText,
      url: `${API_BASE_URL}/api/chat/stream`,
      error: errorText
    })
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
                console.error('Failed to parse SSE data:', e)
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
            console.error('Failed to parse SSE data:', e)
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

