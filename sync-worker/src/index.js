const CODE_PATTERN = /^[A-Z0-9]{6,8}$/
const MAX_MESSAGE_BYTES = 8192
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const MEDIA_CHUNK_BYTES = 1024 * 1024

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'RichGuyLos Radio Sync' }, { headers: corsHeaders() })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
    const mediaMatch = url.pathname.match(/^\/media\/([A-Z0-9]{6,8})\/([a-f0-9-]{36})$/i)
    if (mediaMatch && request.method === 'GET') {
      const code = mediaMatch[1].toUpperCase()
      return env.ROOMS.getByName(code).fetch(new Request(`https://room.local/media?id=${mediaMatch[2]}`, request))
    }
    const uploadMatch = url.pathname.match(/^\/upload\/([A-Za-z0-9-]+)$/)
    if (uploadMatch && request.method === 'POST') {
      const code = uploadMatch[1].replace(/-/g, '').toUpperCase()
      if (!CODE_PATTERN.test(code)) return new Response('Invalid pairing code', { status: 400, headers: corsHeaders() })
      return env.ROOMS.getByName(code).fetch(new Request(`https://room.local/upload?origin=${encodeURIComponent(url.origin)}&code=${code}`, request))
    }
    const match = url.pathname.match(/^\/sync\/([A-Za-z0-9-]+)$/)
    if (!match || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('RichGuyLos Radio Sync', { status: 404, headers: corsHeaders() })
    const code = match[1].replace(/-/g, '').toUpperCase()
    const role = url.searchParams.get('role')
    if (!CODE_PATTERN.test(code) || !['phone', 'game'].includes(role)) return new Response('Invalid pairing code or role', { status: 400 })
    return env.ROOMS.getByName(code).fetch(new Request(`https://room.local/connect?role=${role}`, request))
  },
}

export class SyncRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.lastState = null
    ctx.blockConcurrencyWhile(async () => { this.lastState = await ctx.storage.get('lastState') || null })
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/upload' && request.method === 'POST') return this.upload(request, url.searchParams.get('origin'), url.searchParams.get('code'))
    if (url.pathname === '/media' && request.method === 'GET') return this.serveMedia(request, url.searchParams.get('id'))
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 })
    const role = new URL(request.url).searchParams.get('role')
    if (!['phone', 'game'].includes(role)) return new Response('Invalid role', { status: 400 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ role })
    server.send(JSON.stringify({ type: 'hello', role, connected: true }))
    if (role === 'game' && this.lastState) server.send(JSON.stringify(this.lastState))
    this.broadcastPresence()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(socket, rawMessage) {
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_MESSAGE_BYTES) return
    let message
    try { message = JSON.parse(rawMessage) } catch { return }
    const role = socket.deserializeAttachment()?.role
    if (role === 'game' && message.type === 'state') {
      const state = sanitizeState(message)
      this.lastState = state
      await this.ctx.storage.put('lastState', state)
      this.broadcast(state, 'phone')
    } else if (role === 'phone' && message.type === 'command') {
      const command = sanitizeCommand(message)
      if (command) this.broadcast(command, 'game')
    } else if (role === 'phone' && message.type === 'load') {
      const load = sanitizeLoad(message)
      if (load) this.broadcast(load, 'game')
    } else if (role === 'phone' && message.type === 'youtube-load') {
      const load = sanitizeYouTubeLoad(message)
      if (load) this.broadcast(load, 'game')
    } else if (role === 'game' && message.type === 'phone-command') {
      const command = sanitizePhoneCommand(message)
      if (command) this.broadcast(command, 'phone')
    } else if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }))
  }

  async upload(request, origin, roomCode) {
    const contentLength = Number(request.headers.get('Content-Length') || 0)
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream'
    if (contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) return new Response('Audio must be between 1 byte and 50 MB', { status: 413, headers: corsHeaders() })
    if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') return new Response('Audio files only', { status: 415, headers: corsHeaders() })
    const id = crypto.randomUUID()
    const previousMeta = await this.ctx.storage.get('mediaMeta')
    const bytes = await request.arrayBuffer()
    const chunkCount = Math.ceil(bytes.byteLength / MEDIA_CHUNK_BYTES)
    const writtenKeys = []
    try {
      for (let index = 0; index < chunkCount; index += 1) {
        const key = mediaChunkKey(id, index)
        const start = index * MEDIA_CHUNK_BYTES
        const end = Math.min(bytes.byteLength, start + MEDIA_CHUNK_BYTES)
        await this.ctx.storage.put(key, bytes.slice(start, end))
        writtenKeys.push(key)
      }
      await this.ctx.storage.put('mediaMeta', { id, size: bytes.byteLength, contentType, chunkCount, uploadedAt: Date.now() })
    } catch (error) {
      if (writtenKeys.length) await this.ctx.storage.delete(writtenKeys)
      throw error
    }
    if (previousMeta?.id && previousMeta.id !== id) {
      await this.ctx.storage.delete(Array.from({ length: previousMeta.chunkCount }, (_, index) => mediaChunkKey(previousMeta.id, index)))
    }
    return Response.json({ streamUrl: `${origin}/media/${roomCode}/${id}`, expires: 'replaced by the next upload' }, { headers: corsHeaders() })
  }

  async serveMedia(request, id) {
    const meta = await this.ctx.storage.get('mediaMeta')
    if (!meta || meta.id !== id) return new Response('Not found', { status: 404, headers: corsHeaders() })
    const range = parseRange(request.headers.get('Range'), meta.size)
    if (range === null) return new Response('Requested range not satisfiable', { status: 416, headers: { ...corsHeaders(), 'Content-Range': `bytes */${meta.size}` } })
    const start = range?.start ?? 0
    const end = range?.end ?? meta.size - 1
    let chunkIndex = Math.floor(start / MEDIA_CHUNK_BYTES)
    const finalChunkIndex = Math.floor(end / MEDIA_CHUNK_BYTES)
    const stream = new ReadableStream({
      pull: async (controller) => {
        if (chunkIndex > finalChunkIndex) return controller.close()
        const stored = await this.ctx.storage.get(mediaChunkKey(id, chunkIndex))
        if (!stored) return controller.error(new Error('Media chunk unavailable'))
        const bytes = new Uint8Array(stored)
        const chunkStart = chunkIndex * MEDIA_CHUNK_BYTES
        const sliceStart = Math.max(0, start - chunkStart)
        const sliceEnd = Math.min(bytes.byteLength, end - chunkStart + 1)
        controller.enqueue(bytes.subarray(sliceStart, sliceEnd))
        chunkIndex += 1
      },
    })
    const headers = new Headers(corsHeaders())
    headers.set('Content-Type', meta.contentType)
    headers.set('Content-Length', String(end - start + 1))
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'private, no-store')
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${meta.size}`)
    return new Response(stream, { status: range ? 206 : 200, headers })
  }

  webSocketClose() { this.broadcastPresence() }
  webSocketError() { this.broadcastPresence() }

  broadcast(message, targetRole) {
    const payload = JSON.stringify(message)
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.deserializeAttachment()?.role !== targetRole) continue
      try { socket.send(payload) } catch { /* Disconnected client. */ }
    }
  }

  broadcastPresence() {
    const sockets = this.ctx.getWebSockets()
    const payload = JSON.stringify({
      type: 'presence',
      phoneConnected: sockets.some((socket) => socket.deserializeAttachment()?.role === 'phone'),
      gameConnected: sockets.some((socket) => socket.deserializeAttachment()?.role === 'game'),
    })
    for (const socket of sockets) {
      try { socket.send(payload) } catch { /* Disconnected client. */ }
    }
  }
}

function sanitizeState(message) {
  return {
    type: 'state', loaded: Boolean(message.loaded), playing: Boolean(message.playing),
    title: String(message.title || 'No music selected').slice(0, 120),
    artist: String(message.artist || 'RichGuyLos Radio').slice(0, 120),
    position: clampNumber(message.position, 0, 86400), duration: clampNumber(message.duration, 0, 86400),
    volume: clampNumber(message.volume, 0, 1), queueLength: clampNumber(message.queueLength, 0, 10000),
    trackIndex: clampNumber(message.trackIndex, 0, 9999),
    canSkip: Boolean(message.canSkip), source: String(message.source || 'phone-file').slice(0, 32), updatedAt: Date.now(),
  }
}

function sanitizeCommand(message) {
  const action = String(message.action || '')
  if (!['play', 'pause', 'next', 'previous', 'volume', 'seek'].includes(action)) return null
  const command = { type: 'command', action }
  if (action === 'volume') command.value = clampNumber(message.value, 0, 1)
  if (action === 'seek') command.value = clampNumber(message.value, 0, 86400)
  return command
}

function sanitizeLoad(message) {
  let url
  try { url = new URL(String(message.url || '')) } catch { return null }
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1') return null
  return {
    type: 'load', url: url.toString(), title: String(message.title || 'Phone audio').slice(0, 120),
    artist: String(message.artist || 'Your phone').slice(0, 120), autoplay: message.autoplay !== false,
    trackIndex: clampNumber(message.trackIndex, 0, 9999), queueLength: clampNumber(message.queueLength, 1, 10000),
  }
}

function sanitizeYouTubeLoad(message) {
  const videoId = String(message.videoId || '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  return {
    type: 'youtube-load', videoId,
    title: String(message.title || 'YouTube Music').slice(0, 120),
    artist: String(message.artist || 'YouTube').slice(0, 120),
    autoplay: message.autoplay !== false,
  }
}

function sanitizePhoneCommand(message) {
  const action = String(message.action || '')
  return ['next', 'previous'].includes(action) ? { type: 'phone-command', action } : null
}

function mediaChunkKey(id, index) {
  return `media:${id}:${String(index).padStart(4, '0')}`
}

function parseRange(header, size) {
  if (!header) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  let start = match[1] ? Number(match[1]) : null
  let end = match[2] ? Number(match[2]) : null
  if (start === null) {
    const suffixLength = end
    if (!suffixLength) return null
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    end = end === null ? size - 1 : Math.min(end, size - 1)
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) return null
  return { start, end }
}

function clampNumber(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  }
}
