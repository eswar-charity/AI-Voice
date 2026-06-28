import { useEffect, useRef, useCallback, useState } from 'react'

type MessageHandler = (msg: Record<string, unknown>) => void

export function useWebSocket(url: string | null, onMessage: MessageHandler) {
  const ws = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!url) return

    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as Record<string, unknown>
        onMessageRef.current(parsed)
      } catch {
        // ignore malformed
      }
    }

    return () => {
      socket.close()
    }
  }, [url])

  const send = useCallback((data: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }, [])

  return { connected, send }
}
