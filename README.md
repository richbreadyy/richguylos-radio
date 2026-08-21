# RichGuyLos Radio

An original, responsive web-radio interface built with React and Vite.

## Included

- Five switchable original station presets
- Procedural in-browser audio that does not rely on third-party music or streams
- Play, pause, previous, next, volume, keyboard, and animated waveform controls
- Two editable private stream slots saved only in local browser storage
- Installable iPhone/Android PWA with local audio-file selection
- Signed native Android APK with a direct QR-code download
- Real private pairing through a Cloudflare Worker and Durable Object room
- Temporary per-driver audio storage with byte-range streaming into CSP `ui.MediaPlayer`
- Two-way phone/game controls for play, pause, seek, previous, next, and volume
- One-time private pairing remembered by both the Android app and the CSP player
- YouTube and YouTube Music links played through YouTube's official embedded player in CSP
- Responsive desktop and mobile layouts
- Accessible labels, focus states, and reduced-motion support

## Run locally

```powershell
pnpm install
pnpm dev
```

Then open the local address shown in the terminal.

## Production build

```powershell
pnpm build
```

The optimized site is written to `dist/`.

## Private in-game audio model

Each driver pairs with a separate code. A selected phone audio file is temporarily uploaded to a private media object and streamed by that driver's CSP client. Controls and playback state travel through the driver's pairing room. Other drivers cannot hear or control it, and the server-wide station is never changed. Uploading another song replaces the previous object for that room.

Protected Apple Music and Spotify libraries cannot be imported. Drivers can choose regular audio files from their phone or paste a YouTube/YouTube Music link. YouTube playback uses the official embedded player; videos whose owners disable embedding cannot play.

## Android app download

The QR code in the CSP panel points directly to the signed APK:

`https://github.com/richbreadyy/richguylos-radio/releases/latest/download/RichGuyLos-Radio.apk`

After the first pairing, the app and CSP script retain the driver's private code and reconnect automatically on later server joins.

## Assetto Corsa server integration

The `csp/` directory contains a separate, original CSP online script. It creates a client-local Microsoft Media Foundation player, connects to the driver's pairing room, plays that driver's temporary stream through Assetto Corsa audio, and exposes working playback controls.

The included `csp-extra-options.ini` block uses `SCRIPT_9`, leaving any existing `SCRIPT_8` configuration unchanged.
