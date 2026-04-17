'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Specialization, Gender } from '@/types';
import { SPECIALIZATION_LABELS } from '@/types';

const ALL_SPECS: Specialization[] = [
  'general', 'medical', 'legal', 'educational', 'mental_health',
  'deaf_interpreter', 'trilingual', 'deaf_blind', 'oral_transliterator',
  'religious', 'performing_arts', 'cart_captioning', 'pediatric', 'other',
];

const LANGUAGE_OPTIONS = ['asl', 'english', 'spanish', 'pse', 'ase', 'tactile', 'protactile', 'other'];
const GENDER_OPTIONS: Gender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say'];

interface Profile {
  headline: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  intro_video_url: string | null;
  intro_video_caption_url: string | null;
  intro_video_transcript: string | null;
  gender: Gender | null;
  pronouns: string | null;
  skills: string[];
  languages: string[];
  specializations: string[];
  service_radius_miles: number;
  is_accepting_offers: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
}

const EMPTY: Profile = {
  headline: '',
  bio: '',
  profile_photo_url: null,
  intro_video_url: null,
  intro_video_caption_url: null,
  intro_video_transcript: '',
  gender: null,
  pronouns: '',
  skills: [],
  languages: ['asl'],
  specializations: ['general'],
  service_radius_miles: 25,
  is_accepting_offers: true,
  current_lat: null,
  current_lng: null,
  last_location_update: null,
};

export default function InterpreterProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'saving' | 'saved' | 'denied' | 'error'>('idle');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/interpreter/me');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setProfile({
            ...EMPTY,
            ...data,
            languages: data.languages?.length ? data.languages : ['asl'],
            specializations: data.specializations?.length ? data.specializations : ['general'],
          });
        }
      }
      setLoading(false);
    })();
  }, []);

  async function uploadMedia(file: File, bucket: string, field: 'profile_photo_url' | 'intro_video_url') {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    setProfile((p) => ({ ...p, [field]: urlData.publicUrl }));
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoUploading(true);
    setError('');
    try {
      await uploadMedia(f, 'interpreter-media', 'profile_photo_url');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setPhotoUploading(false);
  }

  async function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideoUploading(true);
    setError('');
    try {
      await uploadMedia(f, 'interpreter-media', 'intro_video_url');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setVideoUploading(false);
  }

  function toggleSpec(s: string) {
    setProfile((p) => ({
      ...p,
      specializations: p.specializations.includes(s)
        ? p.specializations.filter((x) => x !== s)
        : [...p.specializations, s],
    }));
  }

  function toggleLang(l: string) {
    setProfile((p) => ({
      ...p,
      languages: p.languages.includes(l)
        ? p.languages.filter((x) => x !== l)
        : [...p.languages, l],
    }));
  }

  function addSkill() {
    const s = newSkill.trim();
    if (!s || profile.skills.includes(s)) return;
    setProfile((p) => ({ ...p, skills: [...p.skills, s] }));
    setNewSkill('');
  }

  async function useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      setLocationStatus('error');
      setError('Your browser does not support location services.');
      return;
    }
    setLocationStatus('requesting');
    setError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15_000,
        });
      });
      setLocationStatus('saving');
      const lat = Number(position.coords.latitude.toFixed(7));
      const lng = Number(position.coords.longitude.toFixed(7));
      const res = await fetch('/api/interpreter/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_lat: lat, current_lng: lng }),
      });
      if (!res.ok) throw new Error('Could not save location');
      setProfile((p) => ({
        ...p,
        current_lat: lat,
        current_lng: lng,
        last_location_update: new Date().toISOString(),
      }));
      setLocationStatus('saved');
      setTimeout(() => setLocationStatus('idle'), 3000);
    } catch (err) {
      const code = (err as GeolocationPositionError | undefined)?.code;
      if (code === 1) {
        setLocationStatus('denied');
      } else {
        setLocationStatus('error');
        setError(err instanceof Error ? err.message : 'Could not get location');
      }
    }
  }

  async function clearLocation() {
    setLocationStatus('saving');
    const res = await fetch('/api/interpreter/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_lat: null, current_lng: null }),
    });
    if (res.ok) {
      setProfile((p) => ({ ...p, current_lat: null, current_lng: null, last_location_update: null }));
      setLocationStatus('idle');
    }
  }

  async function save() {
    setError('');
    setSaving(true);
    const res = await fetch('/api/interpreter/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || 'Save failed');
    } else {
      setSavedAt(new Date());
    }
    setSaving(false);
  }

  if (loading) return <div className="py-12 text-slate-500">Loading profile…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Your profile</h1>
        <p className="text-slate-600 mt-1">
          This is what Deaf clients and businesses see before they book you.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm"
        >
          {error}
        </div>
      )}

      {/* Availability toggle */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-semibold text-slate-900">Accepting new offers</div>
            <div className="text-xs text-slate-500 mt-0.5">
              When off, you won&apos;t receive new booking offers or show in the feed.
            </div>
          </div>
          <input
            type="checkbox"
            checked={profile.is_accepting_offers}
            onChange={(e) => setProfile((p) => ({ ...p, is_accepting_offers: e.target.checked }))}
            className="h-5 w-5 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
          />
        </label>
      </section>

      {/* Photo */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Profile photo</h2>
        <div className="flex items-center gap-4">
          {profile.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
              No photo
            </div>
          )}
          <label className="block flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              disabled={photoUploading}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:cursor-pointer hover:file:bg-slate-800"
            />
            {photoUploading && <p className="text-xs text-blue-600 mt-1">Uploading…</p>}
          </label>
        </div>
      </section>

      {/* Headline + Bio */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="headline" className="block text-sm font-medium text-slate-700 mb-1">
            Headline
          </label>
          <input
            id="headline"
            type="text"
            value={profile.headline || ''}
            onChange={(e) => setProfile((p) => ({ ...p, headline: e.target.value }))}
            maxLength={140}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            placeholder="E.g., Trilingual medical interpreter with 8 years in pediatric oncology"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1">
              Gender
            </label>
            <select
              id="gender"
              value={profile.gender ?? ''}
              onChange={(e) => setProfile((p) => ({
                ...p,
                gender: (e.target.value || null) as Gender | null,
              }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">—</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pronouns" className="block text-sm font-medium text-slate-700 mb-1">
              Pronouns
            </label>
            <input
              id="pronouns"
              type="text"
              value={profile.pronouns || ''}
              onChange={(e) => setProfile((p) => ({ ...p, pronouns: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="e.g., she/her"
            />
          </div>
        </div>
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            rows={4}
            value={profile.bio || ''}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            maxLength={4000}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl resize-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="Tell clients about your background, experience, and what you specialize in..."
          />
        </div>
      </section>

      {/* Specializations + Languages + Skills */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Specializations</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_SPECS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpec(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition ${
                  profile.specializations.includes(s)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {SPECIALIZATION_LABELS[s as Specialization] || s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Languages</h2>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggleLang(l)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition uppercase ${
                  profile.languages.includes(l)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() =>
                    setProfile((p) => ({ ...p, skills: p.skills.filter((x) => x !== s) }))
                  }
                  className="hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="Add a skill (e.g., ProTactile, Theatrical, Trauma-informed)"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Service radius */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Service radius</h2>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={profile.service_radius_miles}
            onChange={(e) => setProfile((p) => ({ ...p, service_radius_miles: Number(e.target.value) }))}
            className="flex-1"
          />
          <span className="text-sm font-semibold text-slate-900 w-20 text-right">
            {profile.service_radius_miles} mi
          </span>
        </div>
      </section>

      {/* Current location */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Current location</h2>
        <p className="text-sm text-slate-600 mb-4">
          Share your location so we can match you with nearby jobs and show clients roughly
          where you are. You can update or clear this anytime.
        </p>

        {profile.current_lat !== null && profile.current_lng !== null ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21l-5.657-5.657a8 8 0 1111.314 0L12 21z" />
                  </svg>
                  Location set
                </div>
                <div className="text-xs text-emerald-800 mt-1 font-mono">
                  {profile.current_lat.toFixed(4)}, {profile.current_lng.toFixed(4)}
                </div>
                {profile.last_location_update && (
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Updated {new Date(profile.last_location_update).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locationStatus === 'requesting' || locationStatus === 'saving'}
                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-medium text-emerald-900 disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={clearLocation}
                  disabled={locationStatus === 'saving'}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locationStatus === 'requesting' || locationStatus === 'saving'}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21l-5.657-5.657a8 8 0 1111.314 0L12 21z" />
            </svg>
            {locationStatus === 'requesting'
              ? 'Asking for permission…'
              : locationStatus === 'saving'
              ? 'Saving…'
              : 'Use my current location'}
          </button>
        )}

        {locationStatus === 'denied' && (
          <p className="text-xs text-rose-700 mt-2">
            Location permission was denied. You can update your browser settings to share
            location with PAH, or keep this off if you prefer.
          </p>
        )}
        {locationStatus === 'saved' && (
          <p className="text-xs text-emerald-700 mt-2 font-medium">Location saved.</p>
        )}
      </section>

      {/* Intro video */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Intro video</h2>
        <p className="text-sm text-slate-600 mb-3">
          Let Deaf clients see your signing style. Captions or transcript required for
          accessibility.
        </p>
        {profile.intro_video_url ? (
          <div className="space-y-3">
            <video controls src={profile.intro_video_url} className="w-full rounded-xl border border-slate-200" />
            <button
              type="button"
              onClick={() => setProfile((p) => ({ ...p, intro_video_url: null }))}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              Remove video
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="video/*"
            onChange={handleVideo}
            disabled={videoUploading}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:cursor-pointer hover:file:bg-slate-800"
          />
        )}
        {videoUploading && <p className="text-xs text-blue-600 mt-1">Uploading…</p>}
        <div className="mt-4">
          <label htmlFor="cap" className="block text-sm font-medium text-slate-700 mb-1">
            Captions URL (optional if you provide a transcript)
          </label>
          <input
            id="cap"
            type="url"
            value={profile.intro_video_caption_url || ''}
            onChange={(e) => setProfile((p) => ({ ...p, intro_video_caption_url: e.target.value || null }))}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="mt-3">
          <label htmlFor="trans" className="block text-sm font-medium text-slate-700 mb-1">
            Written transcript (alternative to captions)
          </label>
          <textarea
            id="trans"
            rows={3}
            value={profile.intro_video_transcript || ''}
            onChange={(e) => setProfile((p) => ({ ...p, intro_video_transcript: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end items-center gap-4 pb-8">
        {savedAt && (
          <span className="text-sm text-emerald-700">Saved {savedAt.toLocaleTimeString()}</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}
