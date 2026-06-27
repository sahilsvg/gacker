import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, X, LocateFixed } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    google?: any;
    __gmapsInit?: () => void;
    __gmapsLoading?: Promise<void>;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

function loadMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;

  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error('Missing Google Maps browser key'));
      return;
    }
    window.__gmapsInit = () => resolve();
    const s = document.createElement('script');
    const channel = TRACKING_ID ? `&channel=${TRACKING_ID}` : '';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&libraries=places,marker&v=weekly&loading=async&callback=__gmapsInit${channel}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return window.__gmapsLoading;
}

export interface LocationValue {
  lat: number;
  lng: number;
  name: string;
}

interface Props {
  value: LocationValue | null;
  onChange: (val: LocationValue | null) => void;
}

const LocationPicker: React.FC<Props> = ({ value, onChange }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const acHostRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const acElRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('reverse-geocode', { body: { lat, lng } });
      if (error) throw error;
      return data?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  const setMarker = (lat: number, lng: number, name?: string) => {
    const g = window.google;
    if (!g || !mapInstance.current) return;
    const pos = { lat, lng };
    if (!markerRef.current) {
      markerRef.current = new g.maps.Marker({ position: pos, map: mapInstance.current, draggable: true });
      markerRef.current.addListener('dragend', async () => {
        const p = markerRef.current.getPosition();
        const la = p.lat();
        const ln = p.lng();
        const n = await reverseGeocode(la, ln);
        onChange({ lat: la, lng: ln, name: n });
      });
    } else {
      markerRef.current.setPosition(pos);
    }
    mapInstance.current.panTo(pos);
    if ((mapInstance.current.getZoom() ?? 2) < 12) mapInstance.current.setZoom(14);
    if (name !== undefined) onChange({ lat, lng, name });
  };

  // Initialize map + autocomplete
  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(async () => {
        if (cancelled || !mapRef.current) return;
        const g = window.google;

        const startCenter = value ? { lat: value.lat, lng: value.lng } : { lat: 20, lng: 0 };
        const startZoom = value ? 14 : 2;
        mapInstance.current = new g.maps.Map(mapRef.current, {
          center: startCenter,
          zoom: startZoom,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        mapInstance.current.addListener('click', async (e: any) => {
          const la = e.latLng.lat();
          const ln = e.latLng.lng();
          const n = await reverseGeocode(la, ln);
          setMarker(la, ln, n);
        });

        if (value) setMarker(value.lat, value.lng);

        // Autocomplete (Places API New)
        try {
          await g.maps.importLibrary('places');
          const PAE = g.maps.places?.PlaceAutocompleteElement;
          if (PAE && acHostRef.current) {
            const el = new PAE();
            el.style.width = '100%';
            acHostRef.current.innerHTML = '';
            acHostRef.current.appendChild(el);
            acElRef.current = el;
            el.addEventListener('gmp-select', async (ev: any) => {
              try {
                const placePrediction = ev?.placePrediction;
                if (!placePrediction) return;
                const place = placePrediction.toPlace();
                await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
                const loc = place.location;
                if (!loc) return;
                const la = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                const ln = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                const name = place.formattedAddress || place.displayName || `${la.toFixed(5)}, ${ln.toFixed(5)}`;
                setMarker(la, ln, name);
              } catch (e) {
                console.error('place select error', e);
              }
            });
          }
        } catch (e) {
          console.error('Autocomplete load failed', e);
        }

        setReady(true);
      })
      .catch((e) => setError(e.message));

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useCurrent = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        const n = await reverseGeocode(la, ln);
        setMarker(la, ln, n);
        setLocating(false);
      },
      (err) => { setError(err.message); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clear = () => {
    if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
    onChange(null);
  };

  if (error) {
    return <div className="text-xs text-destructive">Map error: {error}</div>;
  }

  return (
    <div className="space-y-2">
      <div ref={acHostRef} className="w-full [&_gmp-place-autocomplete]:w-full" />

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useCurrent} disabled={locating || !ready} className="flex-1">
          {locating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="mr-2 h-3.5 w-3.5" />}
          {locating ? 'Locating…' : 'Use current location'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      <div ref={mapRef} className="w-full h-64 rounded-md border border-border bg-muted/30" />

      {value && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-background/50 p-2.5">
          <MapPin size={14} className="mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground break-words">{value.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </div>
          </div>
        </div>
      )}

      {!ready && !error && (
        <div className="text-[11px] text-muted-foreground">Loading map…</div>
      )}
    </div>
  );
};

export default LocationPicker;
