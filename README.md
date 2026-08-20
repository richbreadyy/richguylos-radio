# RichGuyLos Radio

An original, responsive web-radio interface built with React and Vite.

## Included

- Five switchable original station presets
- Procedural in-browser audio that does not rely on third-party music or streams
- Play, pause, previous, next, volume, keyboard, and animated waveform controls
- Two editable private stream slots saved only in local browser storage
- Installable iPhone/Android PWA with local audio-file selection
- Real private pairing through a Cloudflare Worker and Durable Object room
- Temporary per-driver audio storage with byte-range streaming into CSP `ui.MediaPlayer`
- Two-way phone/game controls for play, pause, seek, previous, next, and volume
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

Protected Apple Music and Spotify libraries cannot be read by a web app. Drivers choose regular audio files from their phone's Files picker. YouTube requires its official visible player and is not extracted into an audio file.

## Assetto Corsa server integration

The `csp/` directory contains a separate, original CSP online script. It creates a client-local Microsoft Media Foundation player, connects to the driver's pairing room, plays that driver's temporary stream through Assetto Corsa audio, and exposes working playback controls.

The included `csp-extra-options.ini` block uses `SCRIPT_9`, leaving any existing `SCRIPT_8` configuration unchanged.
