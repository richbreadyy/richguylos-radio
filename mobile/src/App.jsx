import { useCallback, useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { defaultStreams, stations } from './data.js'
import { LinkIcon, LockIcon, PhoneIcon, PlayIcon, SignalIcon, SkipIcon, VolumeIcon } from './icons.jsx'
import { useRadioEngine } from './useRadioEngine.js'
import { usePhonePlayer } from './usePhonePlayer.js'
import { useSyncSocket } from './useSyncSocket.js'

const SYNC_ENDPOINT = import.meta.env.VITE_SYNC_URL || ''
const IS_NATIVE_APP = Capacitor.isNativePlatform() || import.meta.env.VITE_NATIVE_APP === '1'

const waveBars = [7, 14, 20, 10, 28, 18, 9, 32, 24, 14, 38, 20, 12, 27, 17, 34, 23, 11, 31, 19, 9, 25, 15, 34, 21, 12, 28, 17, 8, 22, 14, 29, 18, 10, 24, 16, 32, 20, 11, 26, 15, 8, 20, 13, 27, 16, 9, 23]

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="RichGuyLos Radio home">
      <span className="brand-mark" aria-hidden="true">RG</span>
      <span>RichGuyLos Radio</span>
    </a>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <Logo />
      <button className="menu-button" type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span /><span />
      </button>
      <nav className={open ? 'nav open' : 'nav'} aria-label="Main navigation">
        <a className="active" href="#listen" onClick={() => setOpen(false)}>Listen</a>
        <a href="#streams" onClick={() => setOpen(false)}>My Streams</a>
      </nav>
      <div className="live-status"><span /> LIVE <SignalIcon /></div>
    </header>
  )
}

function Waveform({ active }) {
  return (
    <div className={active ? 'waveform active' : 'waveform'} aria-hidden="true">
      {waveBars.map((height, index) => <i key={index} style={{ '--bar': `${height}px`, '--delay': `${(index % 8) * -0.09}s` }} />)}
    </div>
  )
}

function RadioConsole({ station, isPlaying, onToggle, onPrevious, onNext, volume, onVolume }) {
  return (
    <div className="console-wrap">
      <div className={isPlaying ? 'tuner playing' : 'tuner'}>
        <div className="tuner-ticks" aria-hidden="true" />
        <div className="tuner-inner">
          <div className="station-live"><span /> LIVE</div>
          <div className="station-name">{station.name}</div>
          <h2>{station.track}</h2>
          <p>{station.genre} / LATE NIGHT</p>
          <Waveform active={isPlaying} />
          <div className="transport">
            <button type="button" aria-label="Previous station" onClick={onPrevious}><SkipIcon back /></button>
            <button className="main-play" type="button" aria-label={isPlaying ? 'Pause radio' : 'Play radio'} onClick={onToggle}><PlayIcon pause={isPlaying} /></button>
            <button type="button" aria-label="Next station" onClick={onNext}><SkipIcon /></button>
          </div>
          <label className="volume-control">
            <span>VOLUME</span>
            <span className="volume-row"><VolumeIcon /><input aria-label="Volume" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(event) => onVolume(Number(event.target.value) / 100)} /><b>{Math.round(volume * 100)}</b></span>
          </label>
        </div>
      </div>
      <div className="up-next"><span>UP NEXT</span><b>▶ &nbsp; CITY LIGHTS</b><em>RichGuyLos Selects</em><time>9:48 PM</time></div>
    </div>
  )
}

function SectionTitle({ icon, children }) {
  return <div className="section-title">{icon}<span>{children}</span><i /></div>
}

function FrequencyBoard({ selected, onSelect, isPlaying }) {
  return (
    <section className="frequencies" aria-labelledby="frequencies-title">
      <SectionTitle icon={<SignalIcon />}><span id="frequencies-title">YOUR FREQUENCIES</span></SectionTitle>
      <div className="frequency-list">
        {stations.map((station, index) => {
          const active = selected === index
          return (
            <button className={active ? 'frequency active' : 'frequency'} type="button" key={station.id} onClick={() => onSelect(index)} aria-pressed={active}>
              <span className="frequency-number">{station.id}</span>
              <strong>{station.name}</strong>
              <small>{station.genre}</small>
              <span className="mini-play"><PlayIcon pause={active && isPlaying} /></span>
              {active ? <em><span /> {isPlaying ? 'LIVE' : 'READY'}</em> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function loadStreams() {
  try {
    const saved = JSON.parse(localStorage.getItem('rgl-radio-streams'))
    return Array.isArray(saved) && saved.length === 2 ? saved : defaultStreams
  } catch {
    return defaultStreams
  }
}

function PrivateStreams() {
  const [streams, setStreams] = useState(loadStreams)
  const [savedId, setSavedId] = useState('')

  const update = (index, field, value) => setStreams((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const save = (stream) => {
    localStorage.setItem('rgl-radio-streams', JSON.stringify(streams))
    setSavedId(stream.id)
    window.setTimeout(() => setSavedId(''), 1600)
  }
  const launch = (stream) => {
    if (!stream.url) return
    const audio = new Audio(stream.url)
    audio.play().catch(() => setSavedId(`error-${stream.id}`))
  }

  return (
    <section id="streams" className="streams section-shell" aria-labelledby="streams-title">
      <SectionTitle icon={<LockIcon />}><span id="streams-title">PRIVATE STREAMS</span></SectionTitle>
      <p className="section-intro">Keep two personal stream links on this device. Nothing leaves your browser.</p>
      <div className="stream-list">
        {streams.map((stream, index) => (
          <article className="stream-row" key={stream.id}>
            <div className="stream-id"><strong>{stream.id}</strong><span>STREAM SLOT</span></div>
            <label><span>STREAM NAME</span><input value={stream.name} onChange={(event) => update(index, 'name', event.target.value)} /></label>
            <label className="url-field"><span>STREAM URL</span><input type="url" placeholder="https://your-stream.example/live" value={stream.url} onChange={(event) => update(index, 'url', event.target.value)} /></label>
            <div className="stream-state"><span>STATUS</span><b className={stream.url ? 'ready' : ''}>{savedId === `error-${stream.id}` ? 'CHECK URL' : savedId === stream.id ? 'SAVED' : stream.url ? 'READY' : 'EMPTY'}</b></div>
            <button className="save-stream" type="button" onClick={() => save(stream)}>Save</button>
            <button className="play-stream" type="button" disabled={!stream.url} aria-label={`Play ${stream.name}`} onClick={() => launch(stream)}><PlayIcon /></button>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatTime(value) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  return `${minutes}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

function initialPairCode() {
  const stored = localStorage.getItem('rgl-pair-code')
  if (/^RG-\d{4}$/.test(stored || '')) return stored
  const code = `RG-${Math.floor(1000 + Math.random() * 9000)}`
  localStorage.setItem('rgl-pair-code', code)
  return code
}

function extractYouTubeId(input) {
  const value = String(input || '').trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1).split('/')[0]) ? url.pathname.slice(1).split('/')[0] : ''
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const fromQuery = url.searchParams.get('v')
      if (/^[A-Za-z0-9_-]{11}$/.test(fromQuery || '')) return fromQuery
      const fromPath = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)
      return fromPath?.[1] || ''
    }
  } catch { /* A plain video ID is handled above. */ }
  return ''
}

function InstallButton() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches)
  useEffect(() => {
    const beforeInstall = (event) => { event.preventDefault(); setPrompt(event) }
    const didInstall = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', didInstall)
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', didInstall)
    }
  }, [])
  const install = async () => {
    if (prompt) {
      prompt.prompt()
      await prompt.userChoice
      setPrompt(null)
      return
    }
    document.getElementById('install-help')?.showModal()
  }
  return <button className="install-button" type="button" disabled={installed} onClick={install}>{installed ? 'Installed on this phone' : 'Install phone app'}</button>
}

function PhoneMusicSection({ nativeApp = false }) {
  const phoneFiles = usePhonePlayer()
  const [files, setFiles] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [transferStatus, setTransferStatus] = useState('idle')
  const [transferError, setTransferError] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [remoteNavigation, setRemoteNavigation] = useState(null)
  const [gameState, setGameState] = useState({ loaded: false, playing: false, title: 'Choose music from your phone', artist: 'RichGuyLos Radio', position: 0, duration: 0, volume: 0.8 })
  const [code, setCode] = useState(initialPairCode)
  const [syncEnabled, setSyncEnabled] = useState(nativeApp)
  const onMessage = useCallback((message) => {
    if (message.type === 'state') setGameState((state) => ({ ...state, ...message }))
    if (message.type === 'phone-command') setRemoteNavigation({ action: message.action, nonce: Date.now() })
  }, [])
  const sync = useSyncSocket({ endpoint: SYNC_ENDPOINT, code: code.replace('-', ''), enabled: syncEnabled, onMessage })
  const sendCommand = (action, value) => sync.send({ type: 'command', action, ...(value === undefined ? {} : { value }) })

  const uploadAndLoad = useCallback(async (file, index, queueTotal = files.length || 1) => {
    if (!file) return
    if (sync.status !== 'connected' || !sync.gameConnected) {
      setTransferError('Open the game panel so the app can reconnect before sending a song.')
      return
    }
    const httpEndpoint = SYNC_ENDPOINT.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '')
    setTransferStatus('uploading')
    setTransferError('')
    try {
      const response = await fetch(`${httpEndpoint}/upload/${code.replace('-', '')}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
      if (!response.ok) throw new Error(await response.text() || 'Upload failed')
      const result = await response.json()
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      const sent = sync.send({ type: 'load', url: result.streamUrl, title, artist: 'Your phone', autoplay: true, trackIndex: index, queueLength: queueTotal })
      if (!sent) throw new Error('The game disconnected before the song was ready.')
      setQueueIndex(index)
      setTransferStatus('sent')
    } catch (error) {
      setTransferStatus('error')
      setTransferError(error.message || 'The song could not be sent to the game.')
    }
  }, [code, files.length, sync])

  const chooseFiles = (fileList) => {
    const selected = Array.from(fileList || []).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    phoneFiles.addFiles(fileList)
    setFiles(selected)
    setQueueIndex(0)
    setGameState((state) => ({ ...state, loaded: false, title: selected[0]?.name.replace(/\.[^.]+$/, '') || state.title }))
    if (selected[0] && sync.status === 'connected') uploadAndLoad(selected[0], 0, selected.length)
  }

  const sendYouTube = () => {
    const videoId = extractYouTubeId(youtubeUrl)
    if (!videoId) {
      setTransferError('Paste a valid YouTube or YouTube Music link.')
      return
    }
    if (sync.status !== 'connected' || !sync.gameConnected) {
      setTransferError('Open the game panel so the app can reconnect first.')
      return
    }
    const sent = sync.send({ type: 'youtube-load', videoId, title: 'YouTube Music', artist: 'YouTube', autoplay: true })
    if (!sent) {
      setTransferError('The game disconnected before YouTube could start.')
      return
    }
    setFiles([])
    setTransferError('')
    setTransferStatus('sent')
    setGameState((state) => ({ ...state, loaded: true, playing: true, title: 'Loading YouTube…', artist: 'YouTube', source: 'youtube' }))
  }

  const previousTrack = () => {
    if (!files.length) return
    const index = (queueIndex - 1 + files.length) % files.length
    uploadAndLoad(files[index], index)
  }
  const nextTrack = () => {
    if (!files.length) return
    const index = (queueIndex + 1) % files.length
    uploadAndLoad(files[index], index)
  }

  useEffect(() => {
    if (remoteNavigation?.action === 'next') nextTrack()
    if (remoteNavigation?.action === 'previous') previousTrack()
  }, [remoteNavigation])

  const changeCode = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    const nextCode = `RG-${digits}`
    setCode(nextCode)
    setSyncEnabled(nativeApp && digits.length === 4)
    if (digits.length === 4) localStorage.setItem('rgl-pair-code', nextCode)
  }
  const syncLabel = sync.status === 'connected' ? (sync.gameConnected ? 'Game connected' : 'Phone online — open the game panel') : sync.status === 'connecting' || sync.status === 'reconnecting' ? 'Connecting…' : sync.status === 'service-needed' ? 'Realtime service is being connected' : 'Connect to game'

  return (
    <section id="phone" className="phone-section" aria-labelledby="phone-title">
      <SectionTitle icon={<PhoneIcon />}><span>PHONE MUSIC APP</span></SectionTitle>
      <div className="phone-app-grid">
        <div className="phone-copy">
          <span className="eyebrow">{nativeApp ? 'ANDROID APP' : 'IPHONE + ANDROID'}</span>
          <h2 id="phone-title">Your music.<br />Inside the race.</h2>
          <p>Install RichGuyLos Radio, pair it to your driver, and send a song to your private in-game player. Each driver hears only their own selection; the server station never changes.</p>
          {nativeApp ? <span className="native-ready">APP INSTALLED • THIS PHONE IS REMEMBERED</span> : <InstallButton />}
          <dialog id="install-help" className="install-help">
            <button type="button" aria-label="Close install instructions" onClick={(event) => event.currentTarget.closest('dialog').close()}>×</button>
            <h3>Install RichGuyLos Radio</h3>
            <p><b>iPhone:</b> open this page in Safari, tap Share, then “Add to Home Screen.”</p>
            <p><b>Android:</b> open this page in Chrome, tap the menu, then “Install app.”</p>
          </dialog>
        </div>

        <div className="phone-player-card">
          <div className="phone-player-head"><span>PRIVATE IN-GAME PLAYER</span><b className={gameState.playing ? 'pulse' : ''}>{transferStatus === 'uploading' ? 'SENDING…' : gameState.playing ? 'PLAYING IN GAME' : gameState.loaded ? 'PAUSED IN GAME' : 'READY'}</b></div>
          <div className="album-tile"><span>RG</span><i /></div>
          <div className="phone-track-copy"><strong>{gameState.title}</strong><span>{gameState.loaded ? `${gameState.artist} • playing only for you` : 'Choose an audio file to send to Assetto Corsa'}</span></div>
          <label className="add-music"><input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => chooseFiles(event.target.files)} /><span>＋ Add music</span></label>
          <div className="youtube-music">
            <label htmlFor="youtube-link">YOUTUBE / YOUTUBE MUSIC LINK</label>
            <div><input id="youtube-link" type="url" inputMode="url" placeholder="Paste a YouTube link" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} /><button type="button" onClick={sendYouTube}>Play in game</button></div>
            <small>Uses YouTube's official embedded player. Videos that block embedding cannot play.</small>
          </div>
          <div className="phone-progress">
            <input aria-label="Track position" type="range" min="0" max={Math.max(1, gameState.duration)} value={Math.min(gameState.position, Math.max(1, gameState.duration))} disabled={!gameState.loaded} onChange={(event) => sendCommand('seek', Number(event.target.value))} />
            <span>{formatTime(gameState.position)}</span><span>{formatTime(gameState.duration)}</span>
          </div>
          <div className="phone-transport">
            <button type="button" aria-label="Previous song" disabled={!files.length || transferStatus === 'uploading'} onClick={previousTrack}><SkipIcon back /></button>
            <button className="phone-main-play" type="button" aria-label={gameState.playing ? 'Pause song in game' : 'Play song in game'} disabled={!gameState.loaded || sync.status !== 'connected'} onClick={() => sendCommand(gameState.playing ? 'pause' : 'play')}><PlayIcon pause={gameState.playing} /></button>
            <button type="button" aria-label="Next song" disabled={!files.length || transferStatus === 'uploading'} onClick={nextTrack}><SkipIcon /></button>
          </div>
          <label className="phone-volume"><VolumeIcon /><input aria-label="In-game music volume" type="range" min="0" max="100" disabled={!gameState.loaded} value={Math.round(gameState.volume * 100)} onChange={(event) => sendCommand('volume', Number(event.target.value) / 100)} /><b>{Math.round(gameState.volume * 100)}</b></label>
          {transferError || phoneFiles.error ? <p className="player-error" role="alert">{transferError || phoneFiles.error}</p> : null}
        </div>
      </div>

      <div className="real-pair-panel">
        <div><span className="eyebrow">PRIVATE PAIRING CODE</span><h3>{code}</h3><p>Enter the same code in the RichGuyLos panel inside Assetto Corsa.</p></div>
        <label><span>CHANGE CODE</span><input inputMode="numeric" value={code} onChange={(event) => changeCode(event.target.value)} /></label>
        <button type="button" disabled={code.length !== 7 || sync.status === 'connecting'} onClick={() => setSyncEnabled((enabled) => !enabled)}><LinkIcon /> {syncEnabled && sync.status !== 'service-needed' ? 'Disconnect' : syncLabel}</button>
        <div className={`sync-state ${sync.status}`}><i /><span>{syncLabel}</span></div>
      </div>

      {files.length ? (
        <div className="phone-queue">
          <span className="eyebrow">YOUR PRIVATE IN-GAME QUEUE</span>
          {files.map((file, trackIndex) => <button className={trackIndex === queueIndex ? 'active' : ''} type="button" key={`${file.name}-${file.size}-${file.lastModified}`} disabled={transferStatus === 'uploading'} onClick={() => uploadAndLoad(file, trackIndex)}><b>{String(trackIndex + 1).padStart(2, '0')}</b><span>{file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')}</span><em>{trackIndex === queueIndex && gameState.loaded ? (gameState.playing ? 'PLAYING IN GAME' : 'PAUSED') : 'SEND TO GAME'}</em></button>)}
        </div>
      ) : null}
    </section>
  )
}

function Footer() {
  return (
    <footer><Logo /><p>Original interface and audio experience by RichGuyLos Radio.</p><span>© 2026 RichGuyLos Radio</span></footer>
  )
}

function RadioHome() {
  const [selectedIndex, setSelectedIndex] = useState(2)
  const [volume, setVolume] = useState(0.68)
  const station = useMemo(() => stations[selectedIndex], [selectedIndex])
  const { isPlaying, toggle } = useRadioEngine(station, volume)
  const selectStation = (index) => setSelectedIndex(index)
  const previous = () => setSelectedIndex((index) => (index - 1 + stations.length) % stations.length)
  const next = () => setSelectedIndex((index) => (index + 1) % stations.length)

  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === 'Space') { event.preventDefault(); toggle() }
      if (event.code === 'ArrowLeft') previous()
      if (event.code === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <div id="top" className="app">
      <Header />
      <main>
        <section id="listen" className="hero">
          <div className="hero-copy">
            <h1>Every city<br />has a <span>sound.</span></h1>
            <div className="orange-rule" />
            <p>Live stations, private streams, and one seamless signal wherever the night takes you.</p>
            <button type="button" className="primary-cta" onClick={toggle}><SignalIcon /> {isPlaying ? 'Pause radio' : 'Start listening'}</button>
          </div>
          <RadioConsole station={station} isPlaying={isPlaying} onToggle={toggle} onPrevious={previous} onNext={next} volume={volume} onVolume={setVolume} />
        </section>
        <FrequencyBoard selected={selectedIndex} onSelect={selectStation} isPlaying={isPlaying} />
        <PrivateStreams />
      </main>
      <Footer />
    </div>
  )
}

function PhoneAppOnly({ nativeApp = false }) {
  return (
    <div id="top" className="app standalone-phone">
      <header className="phone-only-header"><Logo /><span>PRIVATE DRIVER APP</span></header>
      <main><PhoneMusicSection nativeApp={nativeApp} /></main>
    </div>
  )
}

export default function App() {
  return IS_NATIVE_APP || window.location.hash === '#phone-app' ? <PhoneAppOnly nativeApp={IS_NATIVE_APP} /> : <RadioHome />
}
