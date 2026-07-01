import React, { useState } from 'react';
import { MapPin, Loader2, X, LocateFixed } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationValue {
  lat: number;
  lng: number;
  name: string;
}

interface Props {
  value: LocationValue | null;
  onChange: (val: LocationValue | null) => void;
}

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address ?? {};
    const parts = [
      a.amenity || a.shop || a.building,
      a.road,
      a.city || a.town || a.village || a.suburb,
      a.state,
    ].filter(Boolean);
    return parts.slice(0, 3).join(', ') || data.display_name?.split(',').slice(0, 2).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

const LocationPicker = ({ value, onChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locate = async () => {
    setLoading(true);
    setError('');
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== 'granted') {
        setError('Location permission denied.');
        setLoading(false);
        return;
      }
      // Use low accuracy (cell/WiFi) — resolves in <1s vs GPS which can take 30s
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 5000,
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      const name = await reverseGeocode(lat, lng);
      onChange({ lat, lng, name });
    } catch (e: any) {
      setError(e?.message ?? 'Could not get location.');
    }
    setLoading(false);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-3">
        <MapPin size={15} className="text-clean flex-shrink-0" />
        <span className="flex-1 text-sm text-foreground truncate">{value.name}</span>
        <button onClick={() => onChange(null)} className="text-muted-foreground p-0.5 flex-shrink-0">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={loading}
        className="flex items-center gap-2 w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-muted-foreground transition-all active:scale-95 disabled:opacity-50"
      >
        {loading
          ? <Loader2 size={15} className="animate-spin flex-shrink-0" />
          : <LocateFixed size={15} className="flex-shrink-0" />
        }
        {loading ? 'Finding location…' : 'Add current location'}
      </button>
      {error && <p className="text-red text-xs mt-1.5 px-1">{error}</p>}
    </div>
  );
};

export default LocationPicker;
