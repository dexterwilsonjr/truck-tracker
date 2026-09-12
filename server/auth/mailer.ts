import type { AppEnv } from "../env.ts"

export interface MailMessage {
  to: string
  subject: string
  text: string
}

/**
 * Transactional mailer. Dev logs the message. Production uses Resend if
 * RESEND_API_KEY is set; otherwise SMTP_URL is reserved for a later adapter.
 */
export async function sendMail(env: AppEnv, message: MailMessage): Promise<void> {
  if (env.resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.mailFrom,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    })
    if (!res.ok) {
      throw new Error(`Resend failed: ${res.status}`)
    }
    return
  }

  if (env.isProd) throw new Error("Production mail is not configured")
  console.info("[mail] Development delivery skipped; configure RESEND_API_KEY to receive recovery emails.")
}
