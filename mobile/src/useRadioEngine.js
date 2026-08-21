import { useEffect, useRef, useState } from 'react'

export function useRadioEngine(station, volume) {
  const [isPlaying, setIsPlaying] = useState(false)
  const engineRef = useRef(null)
  const volumeRef = useRef(volume)

  useEffect(() => {
    volumeRef.current = volume
    if (engineRef.current?.gain) {
      engineRef.current.gain.gain.setTargetAtTime(volume * 0.08, engineRef.current.context.currentTime, 0.05)
    }
  }, [volume])

  useEffect(() => {
    if (!isPlaying) return
    stopEngine(engineRef)
    startEngine(engineRef, station, volumeRef.current)
    return () => stopEngine(engineRef)
  }, [station, isPlaying])

  useEffect(() => () => stopEngine(engineRef), [])

  const toggle = () => setIsPlaying((playing) => !playing)
  return { isPlaying, toggle }
}

function startEngine(ref, station, volume) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  const context = new AudioContext()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()
  const compressor = context.createDynamicsCompressor()
  const master = context.createGain()
  const oscillators = []
  const timerIds = []

  gain.gain.value = volume * 0.08
  filter.type = 'lowpass'
  filter.frequency.value = 680
  filter.Q.value = 1.8
  master.gain.value = 0.65
  gain.connect(filter).connect(compressor).connect(master).connect(context.destination)

  const frequencies = [station.root, station.root * 1.5, station.root * 2]
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const voiceGain = context.createGain()
    oscillator.type = index === 0 ? 'sine' : 'triangle'
    oscillator.frequency.value = frequency
    voiceGain.gain.value = index === 0 ? 0.55 : 0.16
    oscillator.connect(voiceGain).connect(gain)
    oscillator.start()
    oscillators.push(oscillator)
  })

  const pulse = () => {
    const now = context.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(0.38, now)
    master.gain.linearRampToValueAtTime(0.72, now + 0.05)
    master.gain.exponentialRampToValueAtTime(0.35, now + 0.5)
  }
  pulse()
  timerIds.push(window.setInterval(pulse, (60_000 / station.tempo) * 2))
  ref.current = { context, gain, oscillators, timerIds }
}

function stopEngine(ref) {
  const engine = ref.current
  if (!engine) return
  engine.timerIds.forEach(window.clearInterval)
  engine.oscillators.forEach((oscillator) => {
    try { oscillator.stop() } catch { /* already stopped */ }
  })
  engine.context.close()
  ref.current = null
}
