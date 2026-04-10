import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-03-31.basil',
  });
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const serviceClient = getServiceClient();

  switch (event.type) {
    case 'account.updated': {
      // Interpreter's Stripe Connect account updated
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled) {
        await serviceClient
          .from('interpreter_profiles')
          .update({ stripe_onboarding_complete: true })
          .eq('stripe_connect_account_id', account.id);
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingId = pi.metadata?.booking_id;
      if (bookingId) {
        await serviceClient
          .from('bookings')
          .update({ payment_status: 'captured' })
          .eq('id', bookingId);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingId = pi.metadata?.booking_id;
      if (bookingId) {
        await serviceClient
          .from('bookings')
          .update({ payment_status: 'failed' })
          .eq('id', bookingId);
      }
      break;
    }

    case 'transfer.created': {
      const transfer = event.data.object as Stripe.Transfer;
      const bookingId = transfer.metadata?.booking_id;
      if (bookingId) {
        await serviceClient
          .from('bookings')
          .update({
            payment_status: 'transferred',
            stripe_transfer_id: transfer.id,
          })
          .eq('id', bookingId);
      }
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  // Audit log
  await serviceClient.from('audit_log').insert({
    action: `stripe_webhook_${event.type}`,
    resource_type: 'stripe_event',
    resource_id: null,
    metadata: { event_id: event.id, event_type: event.type },
  });

  return NextResponse.json({ received: true });
}
