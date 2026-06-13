import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3004'

let socket: Socket | null = null

export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20_000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message)
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket(): Socket | null {
  return socket
}

export function reconnectSocket(newToken: string) {
  disconnectSocket()
  return connectSocket(newToken)
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false
}
