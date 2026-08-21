export function PlayIcon({ pause = false }) {
  return pause ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z" fill="currentColor" /></svg>
  )
}

export function SkipIcon({ back = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={back ? 'flip-icon' : ''}>
      <path d="M5 6h2v12H5zM9 6l10 6-10 6z" fill="currentColor" />
    </svg>
  )
}

export function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="M16 8.2a5.4 5.4 0 0 1 0 7.6M18.5 5.7a8.9 8.9 0 0 1 0 12.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 18v-3m4 3v-7m4 7V6m4 12V9m4 9V3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
  )
}

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M10 5h4M11 19h2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  )
}

export function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 14.5 5-5M7.5 16.5l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M16.5 7.5l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  )
}
