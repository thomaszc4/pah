'use client';

import { useEffect, useState } from 'react';

/**
 * Pushes the interpreter's browser geolocation to /api/bookings/{id}/location
 * every 30 seconds while the booking is in `interpreter_en_route` status.
 */
export function LocationPusher({ bookingId }: { bookingId: string }) {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'unavailable' | 'pushing'>('idle');
  const [lastEta, setLastEta] = useState<number | null>(null);
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    let watchId: number | null = null;
    let lastPushAt = 0;

    function pushLocation(position: GeolocationPosition) {
      const now = Date.now();
      if (now - lastPushAt < 30_000) return;
      lastPushAt = now;
      setStatus('pushing');
      fetch(`/api/bookings/${bookingId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.eta_minutes !== undefined) setLastEta(data.eta_minutes);
            setStatus('granted');
          }
        })
        .catch((err) => setLastError(err instanceof Error ? err.message : 'push failed'));
    }

    watchId = navigator.geolocation.watchPosition(
      pushLocation,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied');
        else setLastError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    setStatus('granted');

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [bookingId]);

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm">
      <div className="font-semibold text-violet-900 mb-1">Live location sharing</div>
      {status === 'unavailable' && (
        <p className="text-violet-800">Your browser doesn&apos;t support geolocation.</p>
      )}
      {status === 'denied' && (
        <p className="text-rose-700">
          Location permission was denied. The client won&apos;t see a live map.
        </p>
      )}
      {(status === 'granted' || status === 'pushing') && (
        <p className="text-violet-800">
          Sharing your location with the client every 30 seconds.
          {lastEta !== null && ` Current ETA: ~${lastEta} min`}
        </p>
      )}
      {lastError && <p className="text-xs text-rose-600 mt-1">{lastError}</p>}
    </div>
  );
}
