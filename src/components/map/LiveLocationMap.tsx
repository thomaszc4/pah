'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface LocationPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  eta_minutes: number | null;
}

/**
 * Live map of interpreter's location, using Leaflet + OpenStreetMap tiles.
 * Leaflet is loaded dynamically (client-only) to avoid SSR issues.
 */
export function LiveLocationMap({
  bookingId,
  destinationLat,
  destinationLng,
}: {
  bookingId: string;
  destinationLat: number | null;
  destinationLng: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const interpreterMarkerRef = useRef<unknown>(null);
  const [latest, setLatest] = useState<LocationPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;
      // Fix default marker icons
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      if (cancelled) return;
      const center: [number, number] =
        destinationLat !== null && destinationLng !== null
          ? [destinationLat, destinationLng]
          : [40.0, -96.0];
      const map = L.map(mapRef.current).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      if (destinationLat !== null && destinationLng !== null) {
        L.marker([destinationLat, destinationLng])
          .addTo(map)
          .bindPopup('Appointment location');
      }
      mapInstanceRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      const map = mapInstanceRef.current as { remove: () => void } | null;
      if (map) map.remove();
    };
  }, [destinationLat, destinationLng]);

  // Subscribe to realtime locations
  useEffect(() => {
    const supabase = createClient();

    async function loadLatest() {
      const { data } = await supabase
        .from('interpreter_locations')
        .select('lat, lng, recorded_at, eta_minutes')
        .eq('booking_id', bookingId)
        .order('recorded_at', { ascending: false })
        .limit(1);
      if (data?.[0]) setLatest(data[0] as LocationPoint);
    }
    loadLatest();

    const channel = supabase
      .channel(`interp-loc:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interpreter_locations',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setLatest(payload.new as LocationPoint);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Update marker when location changes
  useEffect(() => {
    if (!mapReady || !latest || !mapInstanceRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current as { setView: (center: [number, number], zoom: number) => void };
      const existing = interpreterMarkerRef.current as {
        setLatLng: (pos: [number, number]) => void;
      } | null;
      const pos: [number, number] = [Number(latest.lat), Number(latest.lng)];
      if (existing) {
        existing.setLatLng(pos);
      } else {
        const icon = L.divIcon({
          className: 'interpreter-marker',
          html: `<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        interpreterMarkerRef.current = L.marker(pos, { icon })
          .addTo(map as never)
          .bindPopup('Interpreter');
      }
      if (destinationLat !== null && destinationLng !== null) {
        map.setView(
          [(pos[0] + destinationLat) / 2, (pos[1] + destinationLng) / 2],
          12,
        );
      }
    })();
  }, [latest, mapReady, destinationLat, destinationLng]);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-900">Interpreter location</span>
        {latest?.eta_minutes !== null && latest?.eta_minutes !== undefined ? (
          <span className="text-sm font-medium text-blue-700">
            ETA ~{latest.eta_minutes} min
          </span>
        ) : (
          <span className="text-xs text-slate-500">Waiting for first ping…</span>
        )}
      </div>
      <div ref={mapRef} className="h-64 sm:h-80 w-full" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    </div>
  );
}
