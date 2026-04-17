import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM;

type TwilioClient = ReturnType<typeof twilio>;
let _client: TwilioClient | null = null;

function client(): TwilioClient | null {
  if (!accountSid || !authToken) return null;
  if (!_client) _client = twilio(accountSid, authToken);
  return _client;
}

export interface SmsPayload {
  to: string;
  body: string;
  statusCallback?: string;
}

export interface SmsResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send SMS via Twilio.
 * Returns {ok:false} if TWILIO credentials are missing (dev stub).
 */
export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const c = client();
  if (!c || !fromNumber) {
    console.warn('[sms] Twilio not configured — skipping SMS to', payload.to);
    return { ok: false, error: 'SMS provider not configured' };
  }
  // E.164 normalization — accept "5551234567" and "+15551234567"
  const normalized = normalizeE164(payload.to);
  if (!normalized) {
    return { ok: false, error: 'Invalid phone number' };
  }
  try {
    const msg = await c.messages.create({
      to: normalized,
      from: fromNumber,
      body: payload.body.slice(0, 1500),
      statusCallback: payload.statusCallback,
    });
    return { ok: true, messageId: msg.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

function normalizeE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (input.startsWith('+')) return input;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
