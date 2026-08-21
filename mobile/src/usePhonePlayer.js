import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function cleanTitle(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function usePhonePlayer() {
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio()
  const urlsRef = useRef([])
  const [tracks, setTracks] = useState([])
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.8)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const current = tracks[index] || null

  const loadCurrent = useCallback((nextIndex, autoplay = false) => {
    const track = tracks[nextIndex]
    const audio = audioRef.current
    if (!track || !audio) return
    audio.src = track.url
    audio.load()
    setIndex(nextIndex)
    setPosition(0)
    setDuration(0)
    if (autoplay) audio.play().catch(() => setError('Tap play once to allow audio on this phone.'))
  }, [tracks])

  const next = useCallback(() => {
    if (!tracks.length) return
    loadCurrent((index + 1) % tracks.length, true)
  }, [index, loadCurrent, tracks.length])

  const previous = useCallback(() => {
    if (!tracks.length) return
    const audio = audioRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    loadCurrent((index - 1 + tracks.length) % tracks.length, true)
  }, [index, loadCurrent, tracks.length])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!current || !audio) return
    if (!audio.src) loadCurrent(index, false)
    audio.play().then(() => setError('')).catch(() => setError('This file could not be played by your phone.'))
  }, [current, index, loadCurrent])

  const pause = useCallback(() => audioRef.current?.pause(), [])
  const toggle = useCallback(() => isPlaying ? pause() : play(), [isPlaying, pause, play])

  const setVolume = useCallback((value) => {
    const normalized = Math.max(0, Math.min(1, value))
    setVolumeState(normalized)
    if (audioRef.current) audioRef.current.volume = normalized
  }, [])

  const seek = useCallback((value) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || value, value))
  }, [])

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    if (!files.length) {
      setError('Choose an MP3, M4A, WAV, AAC, OGG, or FLAC file.')
      return
    }
    urlsRef.current.forEach(URL.revokeObjectURL)
    const nextTracks = files.map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}`, title: cleanTitle(file.name), artist: 'Your phone', url: URL.createObjectURL(file) }))
    urlsRef.current = nextTracks.map((track) => track.url)
    setTracks(nextTracks)
    setIndex(0)
    setError('')
    const audio = audioRef.current
    audio.pause()
    audio.src = nextTracks[0].url
    audio.load()
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    const update = () => {
      setPosition(audio.currentTime || 0)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.volume = volume
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('durationchange', update)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', next)
    return () => {
      audio.removeEventListener('timeupdate', update)
      audio.removeEventListener('durationchange', update)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', next)
    }
  }, [next, volume])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: 'RichGuyLos Radio' })
    const actions = { play, pause, previoustrack: previous, nexttrack: next, seekto: (details) => seek(details.seekTime) }
    Object.entries(actions).forEach(([name, handler]) => {
      try { navigator.mediaSession.setActionHandler(name, handler) } catch { /* Unsupported action. */ }
    })
  }, [current, next, pause, play, previous, seek])

  useEffect(() => () => {
    audioRef.current?.pause()
    urlsRef.current.forEach(URL.revokeObjectURL)
  }, [])

  return useMemo(() => ({ tracks, current, index, isPlaying, volume, position, duration, error, addFiles, play, pause, toggle, next, previous, setVolume, seek, select: (nextIndex) => loadCurrent(nextIndex, isPlaying) }), [addFiles, current, duration, error, index, isPlaying, loadCurrent, next, pause, play, position, previous, seek, setVolume, toggle, tracks, volume])
}
