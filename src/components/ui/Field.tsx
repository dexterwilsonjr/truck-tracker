import { useId } from "react"
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"

const inputBase = [
  "w-full rounded-2xl border border-line bg-night/60 px-4 text-[15px] text-ink transition",
  "h-12",
  "placeholder:text-faint",
  "hover:border-white/15",
  "focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25",
].join(" ")

interface FieldShellProps {
  id?: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
}

function Label({ id, label, optional }: Pick<FieldShellProps, "id" | "label" | "optional">) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-muted">
      {label}
      {optional && (
        <span className="ml-1 font-normal text-faint">(optional)</span>
      )}
    </label>
  )
}

function HintError({ hint, error }: { hint?: string; error?: string }) {
  if (error) {
    return (
      <p id="field-error" className="mt-1.5 text-[13px] text-danger">
        {error}
      </p>
    )
  }
  if (hint) {
    return <p id="field-hint" className="mt-1.5 text-[12px] text-faint">{hint}</p>
  }
  return null
}

export function TextField({
  label,
  hint,
  error,
  optional,
  ...inputProps
}: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId()
  const id = inputProps.id ?? autoId
  return (
    <div>
      <Label id={id} label={label} optional={optional} />
      <input
        {...inputProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "field-error" : hint ? "field-hint" : undefined}
        className={inputBase}
      />
      <HintError hint={hint} error={error} />
    </div>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  rows = 4,
  ...areaProps
}: FieldShellProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { rows?: number }) {
  const autoId = useId()
  const id = areaProps.id ?? autoId
  return (
    <div>
      <Label id={id} label={label} optional={optional} />
      <textarea
        {...areaProps}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "field-error" : hint ? "field-hint" : undefined}
        className={`${inputBase} resize-y py-3 leading-relaxed`}
      />
      <HintError hint={hint} error={error} />
    </div>
  )
}
