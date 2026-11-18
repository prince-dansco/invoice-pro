import "server-only";

// Minimal Resend client over fetch (https://resend.com/docs/api-reference/emails/send-email).
// The API key is read only here, on the server, and never sent to the browser.

export type EmailConfig = { apiKey: string; from: string };

/** Null when email isn't set up; the rest of the app works without it. */
export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  attachments?: { filename: string; content: Buffer }[];
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Sends one email. Resolves only once Resend has accepted or rejected it. */
export async function sendEmail(config: EmailConfig, email: OutgoingEmail): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        attachments: email.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, error: "Couldn't reach the email service. Check your connection and try again." };
  }

  const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (res.ok && body?.id) return { ok: true, id: body.id };

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "The email service rejected the API key. Check RESEND_API_KEY." };
  }
  if (res.status === 429) return { ok: false, error: "Too many emails sent in a short time. Wait a minute and try again." };
  // Resend's validation messages are about configuration (for example an
  // unverified sending domain), so they're useful to show. Keep them short and plain.
  const detail = body?.message?.replace(/\s+/g, " ").slice(0, 200);
  return { ok: false, error: detail ? `The email service didn't accept this email: ${detail}` : "The email service didn't accept this email." };
}
