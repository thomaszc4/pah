import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM || 'PAH <notifications@pah.app>';

let _client: Resend | null = null;

function client(): Resend | null {
  if (!apiKey) return null;
  if (!_client) _client = new Resend(apiKey);
  return _client;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface EmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send transactional email via Resend.
 * Returns {ok:false} if RESEND_API_KEY is missing (dev stub).
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const c = client();
  if (!c) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', payload.to);
    return { ok: false, error: 'Email provider not configured' };
  }
  try {
    const res = await c.emails.send({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      text: payload.text ?? '',
      html: payload.html,
      replyTo: payload.replyTo,
    });
    if (res.error) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, messageId: res.data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
