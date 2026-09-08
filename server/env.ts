function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required env ${name}`)
  }
  return value
}

export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV ?? "development"
  const isProd = nodeEnv === "production"

  return {
    nodeEnv,
    isProd,
    port: Number(process.env.PORT ?? "8787"),
    databaseUrl: required(
      "DATABASE_URL",
      "postgres://truck:truck@127.0.0.1:5432/truck_tracker",
    ),
    sessionSecret: required(
      "SESSION_SECRET",
      isProd ? undefined : "dev-session-secret-change-me",
    ),
    frontendOrigin: (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173").replace(
      /\/$/,
      "",
    ),
    cookieName: process.env.COOKIE_NAME ?? "tt_session",
    mailFrom: process.env.MAIL_FROM ?? "Truck Tracker <noreply@localhost>",
    resendApiKey: process.env.RESEND_API_KEY,
    smtpUrl: process.env.SMTP_URL,
    platformAdminEmail: (
      process.env.PLATFORM_ADMIN_EMAIL ?? "platform@localhost"
    ).toLowerCase(),
    platformAdminPassword: process.env.PLATFORM_ADMIN_PASSWORD ?? "changeme",
    seedBandSlug: process.env.SEED_BAND_SLUG ?? "tobago-carnival",
    seedBandName: process.env.SEED_BAND_NAME ?? "Tobago Carnival",
    seedOrganizerEmail: (
      process.env.SEED_ORGANIZER_EMAIL ?? "organizer@localhost"
    ).toLowerCase(),
    seedOrganizerPassword: process.env.SEED_ORGANIZER_PASSWORD ?? "changeme",
  }
}

export type AppEnv = ReturnType<typeof loadEnv>
