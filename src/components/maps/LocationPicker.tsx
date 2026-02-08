import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LocationPickerProps {
  value?: { lat: number; lng: number; address?: string };
  onChange: (location: { lat: number; lng: number; address: string }) => void;
  placeholder?: string;
  className?: string;
  showMap?: boolean;
}

export function LocationPicker({
  value,
  onChange,
  placeholder = 'Enter location or use current location',
  className = '',
  showMap = false,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [address, setAddress] = useState(value?.address || '');
  const [isLocating, setIsLocating] = useState(false);
  const [mapVisible, setMapVisible] = useState(showMap);

  // Initialize map
  useEffect(() => {
    if (!mapVisible || !mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = value?.lat && value?.lng 
      ? [value.lat, value.lng] 
      : [-1.2921, 36.8219]; // Nairobi default

    const map = L.map(mapRef.current).setView(defaultCenter, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Add initial marker if value exists
    if (value?.lat && value?.lng) {
      markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
    }

    // Handle map clicks
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      updateMarker(lat, lng);
      const addr = await reverseGeocode(lat, lng);
      setAddress(addr);
      onChange({ lat, lng, address: addr });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapVisible]);

  const updateMarker = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
    }
    mapInstanceRef.current.setView([lat, lng], 15);
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const geocodeAddress = async (searchAddress: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&countrycodes=ke&limit=1`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        updateMarker(latitude, longitude);
        onChange({ lat: latitude, lng: longitude, address: display_name });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        updateMarker(latitude, longitude);
        const addr = await reverseGeocode(latitude, longitude);
        setAddress(addr);
        onChange({ lat: latitude, lng: longitude, address: addr });
        setIsLocating(false);
        if (!mapVisible) setMapVisible(true);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please enter it manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  const handleAddressBlur = async () => {
    if (address.trim()) {
      await geocodeAddress(address);
    }
  };

  const handleAddressKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await geocodeAddress(address);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={address}
            onChange={handleAddressChange}
            onBlur={handleAddressBlur}
            onKeyDown={handleAddressKeyDown}
            placeholder={placeholder}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={getCurrentLocation}
          disabled={isLocating}
          title="Use current location"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </Button>
        {!mapVisible && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setMapVisible(true)}
          >
            Show Map
          </Button>
        )}
      </div>

      {mapVisible && (
        <div
          ref={mapRef}
          className="h-64 rounded-lg border overflow-hidden"
          style={{ zIndex: 0 }}
        />
      )}
    </div>
  );
}
