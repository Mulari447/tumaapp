import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigation, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const runnerIcon = L.divIcon({
  html: `<div class="bg-primary text-primary-foreground rounded-full p-2 shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const errandIcon = L.divIcon({
  html: `<div class="bg-green-500 text-white rounded-full p-2 shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface NearbyErrand {
  errand_id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  location: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  created_at: string;
}

interface NearbyErrandsMapProps {
  radiusKm?: number;
  onErrandSelect?: (errand: NearbyErrand) => void;
}

export function NearbyErrandsMap({ radiusKm = 10, onErrandSelect }: NearbyErrandsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const runnerMarkerRef = useRef<L.Marker | null>(null);
  const errandMarkersRef = useRef<L.Marker[]>([]);
  
  const [runnerLocation, setRunnerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyErrands, setNearbyErrands] = useState<NearbyErrand[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedErrand, setSelectedErrand] = useState<NearbyErrand | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [-1.2921, 36.8219]; // Nairobi

    const map = L.map(mapRef.current).setView(defaultCenter, 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Try to get runner's location on mount
    getCurrentLocation();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update errand markers when nearby errands change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing errand markers
    errandMarkersRef.current.forEach(marker => marker.remove());
    errandMarkersRef.current = [];

    // Add new markers
    nearbyErrands.forEach(errand => {
      if (errand.latitude && errand.longitude) {
        const marker = L.marker([errand.latitude, errand.longitude], { icon: errandIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-semibold">${errand.title}</h3>
              <p class="text-sm text-gray-600">${errand.location}</p>
              <p class="text-sm font-medium text-green-600">KES ${errand.budget.toLocaleString()}</p>
              <p class="text-xs text-gray-500">${errand.distance_km.toFixed(1)} km away</p>
            </div>
          `)
          .on('click', () => {
            setSelectedErrand(errand);
            onErrandSelect?.(errand);
          });
        errandMarkersRef.current.push(marker);
      }
    });
  }, [nearbyErrands, onErrandSelect]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setRunnerLocation({ lat: latitude, lng: longitude });
        
        if (mapInstanceRef.current) {
          // Update runner marker
          if (runnerMarkerRef.current) {
            runnerMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            runnerMarkerRef.current = L.marker([latitude, longitude], { icon: runnerIcon })
              .addTo(mapInstanceRef.current)
              .bindPopup('You are here');
          }
          mapInstanceRef.current.setView([latitude, longitude], 14);
        }

        // Update location in profile and fetch nearby errands
        await updateRunnerLocation(latitude, longitude);
        await fetchNearbyErrands(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please enable location services.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updateRunnerLocation = async (lat: number, lng: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({
          current_latitude: lat,
          current_longitude: lng,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const fetchNearbyErrands = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('find_nearby_errands', {
        runner_lat: lat,
        runner_lng: lng,
        radius_km: radiusKm,
      });

      if (error) throw error;
      setNearbyErrands(data || []);
    } catch (error) {
      console.error('Error fetching nearby errands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (runnerLocation) {
      fetchNearbyErrands(runnerLocation.lat, runnerLocation.lng);
    } else {
      getCurrentLocation();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={getCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            Update Location
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <Badge variant="secondary">
          {nearbyErrands.length} errands within {radiusKm}km
        </Badge>
      </div>

      <div
        ref={mapRef}
        className="h-[400px] rounded-lg border overflow-hidden"
        style={{ zIndex: 0 }}
      />

      {selectedErrand && (
        <Card className="border-primary">
          <CardHeader className="py-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{selectedErrand.title}</CardTitle>
              <Badge>{selectedErrand.category}</Badge>
            </div>
          </CardHeader>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground mb-2">{selectedErrand.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {selectedErrand.location}
                <span className="text-primary font-medium">
                  ({selectedErrand.distance_km.toFixed(1)} km away)
                </span>
              </div>
              <span className="text-lg font-bold text-primary">
                KES {selectedErrand.budget.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List of nearby errands */}
      {nearbyErrands.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Nearby Errands</h3>
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {nearbyErrands.map((errand) => (
              <button
                key={errand.errand_id}
                onClick={() => {
                  setSelectedErrand(errand);
                  onErrandSelect?.(errand);
                  if (mapInstanceRef.current && errand.latitude && errand.longitude) {
                    mapInstanceRef.current.setView([errand.latitude, errand.longitude], 15);
                  }
                }}
                className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent ${
                  selectedErrand?.errand_id === errand.errand_id ? 'border-primary bg-accent' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{errand.title}</p>
                    <p className="text-xs text-muted-foreground">{errand.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">KES {errand.budget.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{errand.distance_km.toFixed(1)} km</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
