import type { ReactNode } from "react"
import { Link } from "react-router-dom"

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "soft"
  | "danger"

export type ButtonSize = "md" | "lg"

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gold text-goldink hover:brightness-110 shadow-[0_14px_30px_-16px] shadow-gold/70",
  secondary:
    "bg-white/[0.06] text-ink border border-line hover:bg-white/[0.11]",
  ghost: "text-muted hover:text-ink hover:bg-white/[0.06]",
  soft: "bg-gold/10 text-gold border border-gold/25 hover:bg-gold/[0.18]",
  danger:
    "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/[0.18]",
}

const SIZES: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-6 text-base",
}

function classes(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return [
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    SIZES[size],
    VARIANTS[variant],
    extra,
  ].join(" ")
}

interface ButtonBase {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  icon?: ReactNode
  fullWidth?: boolean
}

type ButtonAsButton = ButtonBase & {
  to?: undefined
  href?: undefined
  type?: "button" | "submit"
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  ariaLabel?: string
}

type ButtonAsLink = ButtonBase & {
  to: string
  /** Router state, so a sign-in redirect can return the user where they were. */
  state?: Record<string, unknown>
  href?: undefined
  onClick?: undefined
  disabled?: undefined
  busy?: undefined
}

type ButtonAsAnchor = ButtonBase & {
  href: string
  to?: undefined
  onClick?: undefined
  disabled?: undefined
  busy?: undefined
}

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor

export function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    className = "",
    icon,
    fullWidth,
  } = props

  const cls = classes(
    variant,
    size,
    `${className}${fullWidth ? " w-full" : ""}`,
  )

  if ("to" in props && props.to) {
    return (
      <Link to={props.to} state={props.state} className={cls}>
        {icon}
        {children}
      </Link>
    )
  }

  if ("href" in props && props.href) {
    return (
      <a href={props.href} className={cls}>
        {icon}
        {children}
      </a>
    )
  }

  const { type = "button", onClick, disabled, busy, ariaLabel } =
    props as ButtonAsButton
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      className={cls}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current opacity-70 [border-top-color:transparent]"
        />
      )}
      {icon}
      {children}
    </button>
  )
}
