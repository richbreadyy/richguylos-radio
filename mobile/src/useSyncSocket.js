import { useCallback, useEffect, useRef, useState } from 'react'

const READY = 1

export function useSyncSocket({ endpoint, code, enabled, onCommand, onMessage }) {
  const [status, setStatus] = useState('idle')
  const [gameConnected, setGameConnected] = useState(false)
  const socketRef = useRef(null)
  const commandRef = useRef(onCommand)
  const messageRef = useRef(onMessage)

  useEffect(() => { commandRef.current = onCommand }, [onCommand])
  useEffect(() => { messageRef.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!enabled || !endpoint || !code) {
      setStatus(enabled && !endpoint ? 'service-needed' : 'idle')
      setGameConnected(false)
      return undefined
    }

    let stopped = false
    let retryTimer
    let socket
    const connect = () => {
      if (stopped) return
      setStatus('connecting')
      const url = `${endpoint.replace(/\/$/, '')}/sync/${encodeURIComponent(code)}?role=phone`
      socket = new WebSocket(url)
      socketRef.current = socket
      socket.addEventListener('open', () => {
        setStatus('connected')
        socket.send(JSON.stringify({ type: 'hello', role: 'phone' }))
      })
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data)
          messageRef.current?.(message)
          if (message.type === 'command') commandRef.current?.(message)
          if (message.type === 'presence') setGameConnected(Boolean(message.gameConnected))
        } catch { /* Ignore malformed relay messages. */ }
      })
      socket.addEventListener('close', () => {
        if (socketRef.current === socket) socketRef.current = null
        setGameConnected(false)
        if (!stopped) {
          setStatus('reconnecting')
          retryTimer = window.setTimeout(connect, 1800)
        }
      })
      socket.addEventListener('error', () => socket.close())
    }
    connect()
    return () => {
      stopped = true
      window.clearTimeout(retryTimer)
      socket?.close()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [code, enabled, endpoint])

  const send = useCallback((message) => {
    const socket = socketRef.current
    if (socket?.readyState !== READY) return false
    socket.send(JSON.stringify(message))
    return true
  }, [])

  return { status, gameConnected, send }
}
