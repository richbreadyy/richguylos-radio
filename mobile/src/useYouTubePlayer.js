import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

let apiPromise

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }
  })
  return apiPromise
}

function parseYouTubeUrl(value) {
  const input = value.trim()
  if (/^[\w-]{11}$/.test(input)) return { kind: 'video', id: input }
  let url
  try { url = new URL(input) } catch { return null }
  const host = url.hostname.replace(/^www\./, '')
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) return null
  const playlistId = url.searchParams.get('list')
  if (playlistId) return { kind: 'playlist', id: playlistId }
  if (host === 'youtu.be') return { kind: 'video', id: url.pathname.slice(1).split('/')[0] }
  const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)
  const videoId = url.searchParams.get('v') || pathMatch?.[1]
  return videoId ? { kind: 'video', id: videoId } : null
}

export function useYouTubePlayer() {
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const pendingRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [media, setMedia] = useState(null)
  const [title, setTitle] = useState('Paste a YouTube video or playlist')
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [error, setError] = useState('')

  const cue = useCallback((nextMedia) => {
    const player = playerRef.current
    if (!player || !readyRef.current || !nextMedia) return
    if (nextMedia.kind === 'playlist') player.cuePlaylist({ listType: 'playlist', list: nextMedia.id, index: 0 })
    else player.cueVideoById(nextMedia.id)
  }, [])

  useEffect(() => {
    let cancelled = false
    let instance
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return
      instance = new YT.Player(mountRef.current, {
        width: '100%', height: '230',
        playerVars: { playsinline: 1, controls: 1, origin: window.location.origin },
        events: {
          onReady: (event) => {
            playerRef.current = event.target
            readyRef.current = true
            event.target.setVolume(volume * 100)
            setReady(true)
            if (pendingRef.current) cue(pendingRef.current)
          },
          onStateChange: (event) => {
            setIsPlaying(event.data === YT.PlayerState.PLAYING)
            const data = event.target.getVideoData?.()
            if (data?.title) setTitle(data.title)
            setDuration(event.target.getDuration?.() || 0)
          },
          onError: () => setError('YouTube could not play that link. Try another public video or playlist.'),
          onAutoplayBlocked: () => setError('Tap the YouTube player once to allow playback on this phone.'),
        },
      })
      playerRef.current = instance
    })
    return () => {
      cancelled = true
      readyRef.current = false
      try { instance?.destroy() } catch { /* Already removed. */ }
      playerRef.current = null
    }
  }, [cue])

  useEffect(() => {
    if (!ready) return undefined
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!player?.getCurrentTime) return
      setPosition(player.getCurrentTime() || 0)
      setDuration(player.getDuration() || 0)
      const data = player.getVideoData?.()
      if (data?.title) setTitle(data.title)
    }, 600)
    return () => window.clearInterval(timer)
  }, [ready])

  const loadUrl = useCallback((value) => {
    const parsed = parseYouTubeUrl(value)
    if (!parsed?.id) {
      setError('Paste a valid YouTube video or playlist link.')
      return false
    }
    pendingRef.current = parsed
    setMedia(parsed)
    setTitle(parsed.kind === 'playlist' ? 'YouTube playlist ready' : 'YouTube video ready')
    setError('')
    setPosition(0)
    setDuration(0)
    cue(parsed)
    return true
  }, [cue])

  const play = useCallback(() => playerRef.current?.playVideo?.(), [])
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), [])
  const toggle = useCallback(() => isPlaying ? pause() : play(), [isPlaying, pause, play])
  const next = useCallback(() => playerRef.current?.nextVideo?.(), [])
  const previous = useCallback(() => playerRef.current?.previousVideo?.(), [])
  const seek = useCallback((value) => playerRef.current?.seekTo?.(Number(value), true), [])
  const setVolume = useCallback((value) => {
    const normalized = Math.max(0, Math.min(1, Number(value)))
    setVolumeState(normalized)
    playerRef.current?.setVolume?.(normalized * 100)
  }, [])

  return useMemo(() => ({
    mountRef, ready, media, current: media ? { title, artist: 'YouTube' } : null,
    title, isPlaying, position, duration, volume, error, canSkip: media?.kind === 'playlist',
    loadUrl, play, pause, toggle, next, previous, seek, setVolume,
  }), [duration, error, isPlaying, loadUrl, media, next, pause, play, position, previous, ready, seek, setVolume, title, toggle, volume])
}
