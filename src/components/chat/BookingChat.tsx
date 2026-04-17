'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessage } from '@/types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function BookingChat({
  bookingId,
  currentUserId,
  disabledReason,
}: {
  bookingId: string;
  currentUserId: string;
  disabledReason?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const listRef = useRef<HTMLDivElement>(null);

  const loadInitial = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data ?? []);
      setLoadStatus('ready');
    } catch {
      setLoadStatus('error');
    }
  }, [bookingId]);

  useEffect(() => {
    loadInitial();
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as ChatMessage;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, loadInitial]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('Send failed');
      setDraft('');
    } catch {
      setSendError("Couldn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[420px] sm:h-[480px]">
      <div className="px-4 py-3 border-b border-slate-100 bg-amber-50">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-amber-900">Booking chat</div>
          <div className="text-xs text-amber-900">
            Do not share protected health information — logistics only
          </div>
        </div>
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
      >
        {loadStatus === 'error' ? (
          <div className="text-sm text-rose-700 text-center py-8">
            Couldn&apos;t load messages.
            <button
              type="button"
              onClick={loadInitial}
              className="ml-2 underline font-medium hover:text-rose-800"
            >
              Retry
            </button>
          </div>
        ) : loadStatus === 'loading' ? (
          <div className="text-sm text-slate-500 text-center py-8">Loading messages…</div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No messages yet. Say hi when you&apos;re ready.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`text-[10px] mt-1 ${mine ? 'text-blue-100' : 'text-slate-600'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 px-3 py-2 bg-slate-50">
        {disabledReason ? (
          <p className="text-xs text-slate-600 py-2 text-center">{disabledReason}</p>
        ) : (
          <>
            {sendError && (
              <p role="alert" className="text-xs text-rose-700 mb-1.5 px-1">
                {sendError}
              </p>
            )}
            <div className="flex gap-2">
              <label htmlFor="chat-input" className="sr-only">
                Type a message
              </label>
              <textarea
                id="chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Message…"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || !draft.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
