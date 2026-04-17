'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Gender, Specialization } from '@/types';
import { SPECIALIZATION_LABELS } from '@/types';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
];

const SPECIALIZATIONS: Specialization[] = [
  'general', 'medical', 'legal', 'educational', 'mental_health',
  'deaf_interpreter', 'trilingual', 'deaf_blind', 'religious', 'performing_arts',
];

interface Preferences {
  preferred_gender: Gender[];
  preferred_specializations: Specialization[];
  preferred_interpreter_ids: string[];
  blocked_interpreter_ids: string[];
  prefers_location_type: 'in_person' | 'vri' | 'no_preference';
  notify_email: boolean;
  notify_sms: boolean;
  notify_push: boolean;
  hide_pricing_for_business: boolean;
  intro_video_url: string | null;
  intro_video_caption_url: string | null;
  intro_video_transcript: string | null;
}

const DEFAULT_PREFS: Preferences = {
  preferred_gender: [],
  preferred_specializations: [],
  preferred_interpreter_ids: [],
  blocked_interpreter_ids: [],
  prefers_location_type: 'no_preference',
  notify_email: true,
  notify_sms: false,
  notify_push: true,
  hide_pricing_for_business: true,
  intro_video_url: null,
  intro_video_caption_url: null,
  intro_video_transcript: null,
};

interface FavoriteInterpreter {
  id: string;
  name: string;
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [favorites, setFavorites] = useState<FavoriteInterpreter[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, email')
        .eq('id', user.id)
        .single();
      if (profile) {
        setPhone(profile.phone || '');
        setEmail(profile.email || '');
      }
      const res = await fetch('/api/deaf/preferences');
      if (res.ok) {
        const data = await res.json();
        setPrefs({ ...DEFAULT_PREFS, ...data });
      }
      // Load names of favorites
      const { data: favIds } = await supabase
        .from('deaf_user_preferences')
        .select('preferred_interpreter_ids')
        .eq('user_id', user.id)
        .maybeSingle();
      if (favIds?.preferred_interpreter_ids?.length) {
        const { data: interps } = await supabase
          .from('interpreter_profiles')
          .select('id, user_id')
          .in('id', favIds.preferred_interpreter_ids);
        if (interps && interps.length > 0) {
          const userIds = interps.map((i) => i.user_id);
          const { data: interpProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          const nameMap = new Map(interpProfiles?.map((p) => [p.id, p.full_name]) || []);
          setFavorites(
            interps.map((i) => ({
              id: i.id,
              name: nameMap.get(i.user_id) || 'Interpreter',
            })),
          );
        }
      }
      setLoading(false);
    })();
  }, []);

  function toggleGender(g: Gender) {
    setPrefs((p) => ({
      ...p,
      preferred_gender: p.preferred_gender.includes(g)
        ? p.preferred_gender.filter((x) => x !== g)
        : [...p.preferred_gender, g],
    }));
  }

  function toggleSpec(s: Specialization) {
    setPrefs((p) => ({
      ...p,
      preferred_specializations: p.preferred_specializations.includes(s)
        ? p.preferred_specializations.filter((x) => x !== s)
        : [...p.preferred_specializations, s],
    }));
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    setVideoUploadError('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage
        .from('deaf-intro-videos')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from('deaf-intro-videos')
        .getPublicUrl(path);
      setPrefs((p) => ({ ...p, intro_video_url: urlData.publicUrl }));
    } catch (err) {
      setVideoUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
    setVideoUploading(false);
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/deaf/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (res.ok) setSavedAt(new Date());
    setSaving(false);
  }

  async function savePhone() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ phone }).eq('id', user.id);
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto py-12 text-slate-500">Loading preferences…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Preferences</h1>
        <p className="text-slate-600 mt-1">Tell us how you like to work with interpreters.</p>
      </div>

      {/* Format preference */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Interpreting format</h2>
        <div className="grid grid-cols-3 gap-3">
          {(['in_person', 'vri', 'no_preference'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, prefers_location_type: v }))}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition ${
                prefs.prefers_location_type === v
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {v === 'in_person' ? 'In person' : v === 'vri' ? 'VRI' : 'No preference'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Under the ADA, your preference is given primary consideration.
        </p>
      </section>

      {/* Interpreter gender */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Interpreter gender</h2>
        <p className="text-sm text-slate-600 mb-3">Pick any that work for you (or leave blank for no preference).</p>
        <div className="grid grid-cols-3 gap-3">
          {GENDERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleGender(value)}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition ${
                prefs.preferred_gender.includes(value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Specializations */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Specializations you often need</h2>
        <div className="grid grid-cols-2 gap-2">
          {SPECIALIZATIONS.map((s) => (
            <label
              key={s}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                prefs.preferred_specializations.includes(s)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={prefs.preferred_specializations.includes(s)}
                onChange={() => toggleSpec(s)}
                className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">{SPECIALIZATION_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Favorites / Blocked */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Favorite interpreters</h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-slate-500">
            You haven&apos;t added any favorites yet. After a booking, tap the star on an
            interpreter&apos;s profile to save them.
          </p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((f) => (
              <li key={f.id} className="flex items-center justify-between text-sm px-3 py-2 bg-slate-50 rounded-lg">
                <span className="font-medium">{f.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      preferred_interpreter_ids: p.preferred_interpreter_ids.filter((id) => id !== f.id),
                    }))
                  }
                  className="text-xs text-slate-500 hover:text-rose-600 font-medium"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Intro video (#6) */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Signing introduction</h2>
        <p className="text-sm text-slate-600 mb-3">
          Optional. Upload a short video introducing yourself so interpreters can see your
          signing style before accepting.
        </p>
        {prefs.intro_video_url ? (
          <div className="space-y-3">
            <video controls src={prefs.intro_video_url} className="w-full rounded-xl border border-slate-200" />
            <button
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, intro_video_url: null }))}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              Remove video
            </button>
          </div>
        ) : (
          <label className="block">
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              disabled={videoUploading}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:cursor-pointer hover:file:bg-slate-800"
            />
            {videoUploading && <p className="text-xs text-blue-600 mt-2">Uploading…</p>}
            {videoUploadError && <p className="text-xs text-rose-600 mt-2">{videoUploadError}</p>}
          </label>
        )}
        <div className="mt-4">
          <label htmlFor="transcript" className="block text-xs font-medium text-slate-700 mb-1">
            Written transcript (optional)
          </label>
          <textarea
            id="transcript"
            rows={3}
            value={prefs.intro_video_transcript || ''}
            onChange={(e) => setPrefs((p) => ({ ...p, intro_video_transcript: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="What you're signing, in English..."
          />
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Notifications</h2>

        <div className="space-y-3">
          <label className="flex items-start justify-between gap-4 p-3 border border-slate-200 rounded-xl cursor-pointer">
            <div>
              <div className="font-medium text-sm text-slate-900">Email</div>
              <div className="text-xs text-slate-500 mt-0.5">Sent to {email}</div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notify_email}
              onChange={(e) => setPrefs((p) => ({ ...p, notify_email: e.target.checked }))}
              className="h-5 w-5 rounded border-slate-400 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-3 border border-slate-200 rounded-xl cursor-pointer">
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">Text messages (SMS)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                We recommend this. No app download needed.
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={savePhone}
                placeholder="(555) 123-4567"
                className="mt-2 w-full sm:w-60 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoComplete="tel"
              />
            </div>
            <input
              type="checkbox"
              checked={prefs.notify_sms}
              onChange={(e) => setPrefs((p) => ({ ...p, notify_sms: e.target.checked }))}
              className="h-5 w-5 rounded border-slate-400 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
          </label>

          <label className="flex items-start justify-between gap-4 p-3 border border-slate-200 rounded-xl cursor-pointer">
            <div>
              <div className="font-medium text-sm text-slate-900">Browser push</div>
              <div className="text-xs text-slate-500 mt-0.5">When you have PAH open in a browser.</div>
            </div>
            <input
              type="checkbox"
              checked={prefs.notify_push}
              onChange={(e) => setPrefs((p) => ({ ...p, notify_push: e.target.checked }))}
              className="h-5 w-5 rounded border-slate-400 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
          </label>
        </div>
      </section>

      {/* Pricing visibility */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Billing visibility</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.hide_pricing_for_business}
            onChange={(e) => setPrefs((p) => ({ ...p, hide_pricing_for_business: e.target.checked }))}
            className="mt-0.5 h-5 w-5 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="font-medium text-sm text-slate-900">
              Hide prices for business bookings (Recommended)
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              When a business books an interpreter for you, we won&apos;t show the charge —
              they&apos;re billed under the ADA.
            </div>
          </div>
        </label>
      </section>

      <div className="flex justify-end items-center gap-4">
        {savedAt && (
          <span className="text-sm text-emerald-700">
            Saved {savedAt.toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}
