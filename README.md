# RichGuyLos Radio

An original, responsive web-radio interface built with React and Vite.

## Included

- Five switchable original station presets
- Procedural in-browser audio that does not rely on third-party music or streams
- Play, pause, previous, next, volume, keyboard, and animated waveform controls
- Two editable private stream slots saved only in local browser storage
- Phone-pairing validation and connected-state demo
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

## Notes

The phone-link experience is a polished front-end simulation. Real cross-device pairing needs a small realtime backend or service such as WebSockets, Supabase Realtime, or Firebase. Private stream URLs are stored only in the current browser.

## Assetto Corsa server integration

The `csp/` directory contains a separate, original CSP online script. It shows a short RichGuyLos Radio invitation in-game and opens the published radio website when selected.

The included `csp-extra-options.ini` block uses `SCRIPT_9`, leaving any existing `SCRIPT_8` configuration unchanged.
