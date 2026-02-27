import { useEffect, useRef, useState } from 'react'
import type { ConnectionStatus } from '../lib/types'

export function useWebSocket(onMessage: (msg: any) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'

    const connect = () => {
      setStatus('connecting')
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectRef.current = 0
        setStatus('connected')
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          onMessage(msg)
        } catch {
          // ignore malformed payload
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
        const delay = Math.min(10000, 1000 * 2 ** reconnectRef.current)
        reconnectRef.current += 1
        setTimeout(connect, delay)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => wsRef.current?.close()
  }, [onMessage])

  return status
}
