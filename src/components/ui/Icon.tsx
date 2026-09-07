/**
 * Minimal inline icon set (stroke-based, ~24px grid).
 * Kept dependency-free so branding swaps are trivial and the bundle stays small.
 */

export type IconName =
  | "truck"
  | "map-pin"
  | "gps"
  | "megaphone"
  | "camera"
  | "compass"
  | "clock"
  | "calendar"
  | "x"
  | "plus"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "warning"
  | "phone"
  | "mail"
  | "message"
  | "globe"
  | "refresh"
  | "image"
  | "pencil"
  | "bell"

export function Icon({
  name,
  className = "size-5",
  strokeWidth = 1.8,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {renderPath(name)}
    </svg>
  )
}

function renderPath(name: IconName) {
  switch (name) {
    case "truck":
      return (
        <>
          <path d="M2.5 7.5h9.8v7.7H2.5Z" />
          <path d="M12.3 9.7h4.7a2 2 0 0 1 2 2v3.5h-6.7" />
          <path d="M2.5 16.9h1" />
          <path d="M15 16.9h1.5" />
          <circle cx="7.2" cy="16.9" r="1.8" />
          <circle cx="16.6" cy="16.9" r="1.8" />
        </>
      )
    case "map-pin":
      return (
        <>
          <path d="M12 21.5s-7.5-5.6-7.5-11.4A7.5 7.5 0 0 1 19.5 10c0 5.8-7.5 11.5-7.5 11.5Z" />
          <circle cx="12" cy="10" r="2.6" />
        </>
      )
    case "gps":
      return (
        <path d="m3 11.5 18-8.5-8.5 18-2.2-7.3L3 11.5Z" />
      )
    case "megaphone":
      return (
        <>
          <path d="M3.5 9.8v4.4a1 1 0 0 0 1 1h2.6l7.6 4.5V5.3L7.1 9.8H4.5a1 1 0 0 0-1 1Z" />
          <path d="M17.5 9a4 4 0 0 1 0 6" />
        </>
      )
    case "camera":
      return (
        <>
          <path d="M8.5 7 9.8 5h4.4l1.3 2" />
          <rect x="3" y="7" width="18" height="13" rx="2.5" />
          <circle cx="12" cy="13" r="3.2" />
        </>
      )
    case "compass":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m15.7 8.3-2 5.4-5.4 2 2-5.4 5.4-2Z" />
        </>
      )
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </>
      )
    case "calendar":
      return (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </>
      )
    case "x":
      return <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    case "plus":
      return <path d="M12 5v14M5 12h14" />
    case "check":
      return <path d="m5 12.5 4.5 4.5L19 7.5" />
    case "chevron-left":
      return <path d="m14.5 6-6 6 6 6" />
    case "chevron-right":
      return <path d="m9.5 6 6 6-6 6" />
    case "chevron-down":
      return <path d="m6 9.5 6 6 6-6" />
    case "warning":
      return (
        <>
          <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
          <path d="M12 10v4.2" />
          <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
        </>
      )
    case "phone":
      return (
        <path d="M6.7 3.5h2.9l1.5 4.9-1.9 1.5a12.5 12.5 0 0 0 5.9 5.9l1.5-1.9 4.9 1.5v2.9a2 2 0 0 1-2.1 2A16.8 16.8 0 0 1 4.7 5.6a2 2 0 0 1 2-2.1Z" />
      )
    case "mail":
      return (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
        </>
      )
    case "message":
      return (
        <path d="M21 11.5a8.3 8.3 0 0 1-8.4 8.2 8.6 8.6 0 0 1-3.7-.8L3 21l1.9-5a8.2 8.2 0 0 1-.9-4.5A8.3 8.3 0 0 1 21 11.5Z" />
      )
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17" />
          <path d="M12 3.5c2.7 2.4 4 5.4 4 8.5s-1.3 6.1-4 8.5c-2.7-2.4-4-5.4-4-8.5s1.3-6.1 4-8.5Z" />
        </>
      )
    case "refresh":
      return (
        <>
          <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
          <path d="M20.5 3.5v5h-5" />
        </>
      )
    case "image":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="9" cy="9.5" r="1.7" />
          <path d="m4 17.5 4.8-4.8 3 3 3.7-3.7 4.5 4.5" />
        </>
      )
    case "pencil":
      return (
        <path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" />
      )
    case "bell":
      return (
        <>
          <path d="M12 3.5a5.5 5.5 0 0 1 5.5 5.5v3.6l1.6 2.6a.8.8 0 0 1-.7 1.2H5.6a.8.8 0 0 1-.7-1.2l1.6-2.6V9A5.5 5.5 0 0 1 12 3.5Z" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </>
      )
  }
}
