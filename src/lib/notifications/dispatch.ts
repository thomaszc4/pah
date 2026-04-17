import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email';
import { sendSms } from './sms';
import type { NotificationChannel } from '@/types';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export interface DispatchInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Override user preferences — force specific channels. */
  channels?: NotificationChannel[];
  /** Short (≤160 char) SMS text. Falls back to `body` if omitted. */
  smsText?: string;
  /** Rich HTML email body. Falls back to auto-built HTML from `body`. */
  emailHtml?: string;
}

/**
 * Primary notification entry point. Inserts into `notifications` (in-app),
 * then fans out to email/SMS based on the user's preferences, recording
 * each delivery in `notification_deliveries`.
 */
export async function sendNotification(input: DispatchInput): Promise<void> {
  const supabase = serviceClient();

  // 1. Insert in-app notification row (realtime + bell icon).
  const { data: notif, error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
    })
    .select()
    .single();

  if (notifError || !notif) {
    console.error('[dispatch] failed to insert notification', notifError);
    return;
  }

  // 2. Look up recipient contact info & preferences.
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('email, phone, full_name')
      .eq('id', input.userId)
      .single(),
    supabase
      .from('deaf_user_preferences')
      .select('notify_email, notify_sms, notify_push')
      .eq('user_id', input.userId)
      .maybeSingle(),
  ]);

  if (!profile) return;

  const channels = new Set<NotificationChannel>(input.channels ?? []);
  if (!input.channels) {
    // Default policy: email yes (unless opt-out), SMS only if opted in.
    if (prefs?.notify_email !== false) channels.add('email');
    if (prefs?.notify_sms === true) channels.add('sms');
  }
  channels.add('in_app');

  // 3. Dispatch email if requested.
  if (channels.has('email') && profile.email) {
    const emailResult = await sendEmail({
      to: profile.email,
      subject: input.title,
      text: `${input.body}\n\nTrack your booking: ${appUrl()}/bookings`,
      html: input.emailHtml ?? buildDefaultEmailHtml(input.title, input.body, profile.full_name ?? ''),
    });
    await supabase.from('notification_deliveries').insert({
      notification_id: notif.id,
      user_id: input.userId,
      channel: 'email',
      provider: 'resend',
      provider_message_id: emailResult.messageId ?? null,
      status: emailResult.ok ? 'sent' : 'failed',
      error: emailResult.error ?? null,
    });
  }

  // 4. Dispatch SMS if requested.
  if (channels.has('sms') && profile.phone) {
    const smsBody = (input.smsText ?? `${input.title}: ${input.body}`).slice(0, 300);
    const smsResult = await sendSms({
      to: profile.phone,
      body: smsBody,
    });
    await supabase.from('notification_deliveries').insert({
      notification_id: notif.id,
      user_id: input.userId,
      channel: 'sms',
      provider: 'twilio',
      provider_message_id: smsResult.messageId ?? null,
      status: smsResult.ok ? 'sent' : 'failed',
      error: smsResult.error ?? null,
    });
  }

  // 5. Log the in-app delivery.
  await supabase.from('notification_deliveries').insert({
    notification_id: notif.id,
    user_id: input.userId,
    channel: 'in_app',
    provider: 'supabase',
    provider_message_id: notif.id,
    status: 'delivered',
    error: null,
  });
}

function buildDefaultEmailHtml(title: string, body: string, name: string): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="padding:28px 32px;border-bottom:1px solid #f1f5f9;">
<div style="font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">PAH</div>
<h1 style="margin:8px 0 0;color:#0f172a;font-size:22px;font-weight:600;line-height:1.3;">${escapeHtml(title)}</h1>
</td></tr>
<tr><td style="padding:24px 32px;color:#334155;font-size:15px;line-height:1.6;">
<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0 0 20px;">${escapeHtml(body)}</p>
<a href="${appUrl()}/bookings" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:500;font-size:14px;">View booking</a>
</td></tr>
<tr><td style="padding:16px 32px 24px;color:#94a3b8;font-size:12px;border-top:1px solid #f1f5f9;">
You received this because you have a PAH account. Manage notifications at <a href="${appUrl()}/preferences" style="color:#475569;">your preferences</a>.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}
