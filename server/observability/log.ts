/**
 * Structured logging and error capture for Cloud Logging.
 *
 * Two rules govern everything here, and both are load-bearing:
 *
 *  1. **Never log a credential, a token, a reset link, or a coordinate.** A
 *     friend position is the most sensitive thing this system handles; a
 *     coordinate in a log line is as bad as one in a response. `redact()` is the
 *     only way values reach a log entry for those fields.
 *  2. **Every error gets a correlation id.** Support reads the id off the user,
 *     and the id ties their report to the exact request and stack.
 *
 * Cloud Logging picks up structured JSON on stdout and treats severity and
 * message specially, so these shapes are deliberate.
 */

export type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL"

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * Strip anything that could carry a credential or a location before logging.
 * Applied to request paths and to error messages, which can both echo input.
 */
export function redact(value: string): string {
  return value
    // Query strings can carry invite tokens and reset tokens.
    .replace(/\?[^\s"']*/g, "?[redacted]")
    // Bearer tokens on the native ingest path.
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    // Session cookie values.
    .replace(/__session=[^;\s"']+/g, "__session=[redacted]")
    // Anything that looks like a hex token at least 32 chars long.
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-token]")
    // Coordinates, if a validation message ever echoes them.
    .replace(/-?\d{1,3}\.\d{4,}/g, "[redacted-number]")
}

function emit(severity: Severity, message: string, fields: LogFields = {}, id?: string): void {
  const entry: Record<string, unknown> = {
    severity,
    message: redact(message),
    ...(id ? { correlationId: id } : {}),
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    entry[key] = typeof value === "string" ? redact(value) : value
  }
  // One line, because Cloud Logging splits multi-line entries badly.
  const line = JSON.stringify(entry)
  if (severity === "ERROR" || severity === "CRITICAL") console.error(line)
  else if (severity === "WARNING") console.warn(line)
  else console.log(line)
}

export const log = {
  info: (message: string, fields?: LogFields, id?: string) => emit("INFO", message, fields, id),
  warn: (message: string, fields?: LogFields, id?: string) => emit("WARNING", message, fields, id),
  error: (message: string, fields?: LogFields, id?: string) => emit("ERROR", message, fields, id),
  critical: (message: string, fields?: LogFields, id?: string) => emit("CRITICAL", message, fields, id),
}

/**
 * Report an error with whatever context the caller has.
 *
 * Stack traces are only emitted when explicitly allowed, because in this
 * codebase a stack can contain a Postgres connection string.
 */
export function captureError(
  error: unknown,
  context: LogFields = {},
  options: { correlationId?: string; includeStack?: boolean; severity?: Severity } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const fields: LogFields = {
    ...context,
    errorName: err.name,
    errorMessage: redact(err.message),
  }
  if (options.includeStack) fields.stack = redact(err.stack ?? "")
  emit(options.severity ?? "ERROR", `Unhandled error in ${context.where ?? "request"}`, fields, options.correlationId)
}

/** Correlation id short enough to read aloud, long enough not to collide. */
export function newCorrelationId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}
