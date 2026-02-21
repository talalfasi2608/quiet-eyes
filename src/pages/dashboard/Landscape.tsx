import { useState, useEffect, useCallback, useRef } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { loadGoogleMaps } from '../../lib/googleMaps';
import { MapPin, Star, Search, RefreshCw, Loader2, AlertTriangle, Crosshair, Zap, Radio, Shield, Target } from 'lucide-react';
import CompetitorGrowthChart from '../../components/ui/CompetitorGrowthChart';
import CompetitorMatrix from '../../components/ui/CompetitorMatrix';
import CompetitorDrawer from '../../components/ui/CompetitorDrawer';

// Dark map style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4a4a6a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f1f35' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
];

// No hardcoded center — derived dynamically from business coordinates

interface Competitor {
  id: string;
  name: string;
  description?: string;
  perceived_threat_level: string;
  google_rating?: number;
  google_reviews_count?: number;
  identified_weakness?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  phone?: string;
}

// Professional scanning animation component
function ScanningOverlay({ businessName }: { businessName: string }) {
  const [dots, setDots] = useState('');
  const [scanPhase, setScanPhase] = useState(0);

  const phases = [
    { text: 'מתחבר ל-Google Places API', icon: Radio },
    { text: 'סורק עסקים באזור', icon: Search },
    { text: 'מנתח ביקורות ודירוגים', icon: Star },
    { text: 'מזהה חולשות מתחרים', icon: Target },
    { text: 'בונה מפת מודיעין', icon: Shield },
  ];

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);

    const phaseInterval = setInterval(() => {
      setScanPhase(prev => (prev + 1) % phases.length);
    }, 2000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(phaseInterval);
    };
  }, []);

  const CurrentIcon = phases[scanPhase].icon;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-xl flex items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-6">
        {/* Animated radar */}
        <div className="relative w-48 h-48 mx-auto">
          {/* Outer rings */}
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-4 rounded-full border-2 border-indigo-500/30 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute inset-8 rounded-full border-2 border-indigo-500/40 animate-ping" style={{ animationDuration: '3s' }} />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-500/50">
              <Crosshair className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>

          {/* Scanning line */}
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(99, 102, 241, 0.3) 30deg, transparent 60deg)',
              animation: 'spin 2s linear infinite'
            }}
          />

          {/* Detected dots */}
          <div className="absolute top-4 right-8 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <div className="absolute top-12 left-6 w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-8 right-12 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Status text */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">
            סורק את האזור{dots}
          </h2>

          <div className="flex items-center justify-center gap-3 text-indigo-400">
            <CurrentIcon className="w-5 h-5 animate-pulse" />
            <span className="text-lg">{phases[scanPhase].text}</span>
          </div>

          <p className="text-gray-500 text-sm">
            מחפש מתחרים עבור {businessName}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${((scanPhase + 1) / phases.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Star rating component
function StarRating({ rating, reviews }: { rating: number; reviews: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < fullStars
                ? 'text-amber-400 fill-amber-400'
                : i === fullStars && hasHalfStar
                ? 'text-amber-400 fill-amber-400/50'
                : 'text-gray-600'
            }`}
          />
        ))}
      </div>
      <span className="text-white font-semibold">{rating.toFixed(1)}</span>
      <span className="text-gray-500 text-sm">({reviews.toLocaleString()})</span>
    </div>
  );
}

export default function Landscape() {
  const { currentProfile } = useSimulation();
  const [searchQuery, setSearchQuery] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<Competitor | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapsReady, setMapsReady] = useState(!!window.google?.maps);

  // Load Google Maps once via shared loader
  useEffect(() => {
    if (!mapsReady) {
      loadGoogleMaps().then(() => setMapsReady(true)).catch(() => {});
    }
  }, [mapsReady]);

  // Fetch competitors from API
  useEffect(() => {
    if (currentProfile?.id) {
      fetchCompetitors(currentProfile.id);
    }
  }, [currentProfile?.id]);

  // Update map center based on business location or competitors — NO hardcoded fallback
  useEffect(() => {
    // Priority 1: Use business coordinates if available (skip 0,0)
    if (currentProfile?.latitude && currentProfile?.longitude &&
        !(currentProfile.latitude === 0 && currentProfile.longitude === 0)) {
      setMapCenter({ lat: currentProfile.latitude, lng: currentProfile.longitude });
      return;
    }

    // Priority 2: Center on competitors if no business coordinates
    if (competitors.length > 0) {
      const validCoords = competitors.filter(c => c.latitude && c.longitude);
      if (validCoords.length > 0) {
        const avgLat = validCoords.reduce((sum, c) => sum + (c.latitude || 0), 0) / validCoords.length;
        const avgLng = validCoords.reduce((sum, c) => sum + (c.longitude || 0), 0) / validCoords.length;
        setMapCenter({ lat: avgLat, lng: avgLng });
      }
    }
  }, [currentProfile?.latitude, currentProfile?.longitude, competitors]);

  const fetchCompetitors = async (businessId: string) => {
    try {
      const response = await fetch(`http://localhost:8015/competitors/${businessId}`);
      if (response.ok) {
        const data = await response.json();
        setCompetitors(data.competitors || []);
      }
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  const handleScanCompetitors = async () => {
    if (!currentProfile?.id) return;
    setLoading(true);
    try {
      // Trigger competitor discovery via radar/discovery endpoint
      const response = await fetch(`http://localhost:8015/radar/sync/${currentProfile.id}`, {
        method: 'POST',
      });
      if (response.ok) {
        // After discovery, fetch the updated competitors list
        await fetchCompetitors(currentProfile.id);
      }
    } catch (error) {
      console.error('Failed to scan competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectAction = useCallback((competitorName: string) => {
    // Create custom event to open AI chat with pre-filled message
    const event = new CustomEvent('openAiChat', {
      detail: {
        message: `תן לי אסטרטגיה ספציפית לגנוב לקוחות מ${competitorName}`
      }
    });
    window.dispatchEvent(event);
  }, []);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'High': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'Medium': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      default: return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    }
  };

  const getMarkerColor = useCallback((level: string) => {
    switch (level) {
      case 'High': return '#ef4444';
      case 'Medium': return '#f59e0b';
      default: return '#6b7280';
    }
  }, []);

  const filteredCompetitors = competitors.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get competitors with valid coordinates
  const mappableCompetitors = filteredCompetitors.filter(c => c.latitude && c.longitude);

  // Initialize / update the raw Google Map — MUST be before any conditional returns
  useEffect(() => {
    if (!mapsReady || !mapCenter || !mapContainerRef.current || !window.google?.maps) return;

    // Create map once
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: mapCenter,
        zoom: 14,
        styles: darkMapStyle,
        disableDefaultUI: true,
        zoomControl: true,
      });

      mapInstanceRef.current.addListener('click', () => {
        infoWindowRef.current?.close();
        setSelectedMarker(null);
      });
    } else {
      mapInstanceRef.current.setCenter(mapCenter);
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Business marker (green)
    if (currentProfile?.latitude && currentProfile?.longitude) {
      const bizMarker = new window.google.maps.Marker({
        position: { lat: currentProfile.latitude, lng: currentProfile.longitude },
        map,
        title: `${currentProfile.nameHebrew} (העסק שלך)`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 1000,
      });
      markersRef.current.push(bizMarker);
    }

    // Competitor markers
    mappableCompetitors.forEach((comp) => {
      const color = getMarkerColor(comp.perceived_threat_level);
      const marker = new window.google.maps.Marker({
        position: { lat: comp.latitude!, lng: comp.longitude! },
        map,
        title: comp.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        setSelectedMarker(comp);

        if (!infoWindowRef.current) {
          infoWindowRef.current = new window.google.maps.InfoWindow();
        }

        const threatLabel = comp.perceived_threat_level === 'High' ? 'גבוה' : comp.perceived_threat_level === 'Medium' ? 'בינוני' : 'נמוך';
        infoWindowRef.current.setContent(`
          <div style="color:#e5e7eb; background:#1f2937; padding:12px; border-radius:8px; min-width:200px; direction:rtl; text-align:right;">
            <strong style="font-size:15px; color:white;">${comp.name}</strong>
            ${comp.google_rating ? `<div style="margin-top:6px;">⭐ ${comp.google_rating} (${comp.google_reviews_count || 0} ביקורות)</div>` : ''}
            ${comp.address ? `<div style="color:#9ca3af; font-size:12px; margin-top:4px;">${comp.address}</div>` : ''}
            <div style="margin-top:6px; font-size:12px; color:${color};">איום: ${threatLabel}</div>
            ${comp.identified_weakness ? `<div style="margin-top:8px; padding:6px; background:rgba(239,68,68,0.1); border-radius:4px; border:1px solid rgba(239,68,68,0.2);"><span style="color:#f87171; font-size:12px;">חולשה: </span><span style="font-size:12px;">${comp.identified_weakness}</span></div>` : ''}
          </div>
        `);
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
    });
  }, [mapsReady, mapCenter, mappableCompetitors, currentProfile?.latitude, currentProfile?.longitude, getMarkerColor]);

  // Full-page loading state with scanning animation
  if (loading) {
    return <ScanningOverlay businessName={currentProfile?.nameHebrew || 'העסק שלך'} />;
  }

  // Loading state
  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-gray-400">טוען מודיעין אמיתי...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">נוף השוק</h1>
          <p className="text-gray-400">מפת המתחרים של {currentProfile.nameHebrew} {currentProfile.emoji}</p>
        </div>
        <button
          onClick={handleScanCompetitors}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          <Search className="w-5 h-5" />
          <span>סרוק מתחרים</span>
        </button>
      </header>

      {/* Google Map */}
      <div className="glass-card p-0 overflow-hidden h-96 relative">
        {mapCenter ? (
          <>
            <div ref={mapContainerRef} className="w-full h-full" />
            {!mapsReady && (
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-indigo-400 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-400">טוען מפה...</p>
                </div>
              </div>
            )}

            {/* Map Legend */}
            <div className="absolute top-4 right-4 glass px-4 py-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                <span className="text-sm text-white">אתה כאן</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-300">איום גבוה</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-gray-300">איום בינוני</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm text-gray-300">איום נמוך</span>
              </div>
            </div>

            {/* Stats overlay */}
            <div className="absolute bottom-4 left-4 glass px-4 py-2 rounded-lg">
              <span className="text-indigo-400 font-bold">{mappableCompetitors.length}</span>
              <span className="text-gray-400 text-sm mr-1">מתחרים על המפה</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/50">
            <MapPin className="w-12 h-12 text-indigo-400 mb-3 animate-pulse" />
            <p className="text-gray-300 font-medium">טוען את מפת העסקים באזור שלך...</p>
            <p className="text-gray-500 text-sm mt-1">המפה תופיע לאחר סריקת מתחרים ראשונה</p>
          </div>
        )}
      </div>

      {/* Market Momentum Chart */}
      <CompetitorGrowthChart />

      {/* Competitor Matrix - Comparison Table */}
      <CompetitorMatrix
        businessId={currentProfile.id}
        businessName={currentProfile.nameHebrew || currentProfile.business_name || 'העסק שלך'}
        businessRating={4.5}
        businessReviews={120}
      />

      {/* Competitors Cards */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">מתחרים שזוהו</h2>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש מתחרה..."
              className="input-glass py-2 pr-10 text-sm w-48"
              dir="rtl"
            />
          </div>
        </div>

        {competitors.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">לא נמצאו מתחרים עדיין</h3>
            <p className="text-gray-500 mb-6">לחץ על "סרוק מתחרים" למציאת מתחרים אמיתיים מ-Google</p>
            <button
              onClick={handleScanCompetitors}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              <span>התחל סריקה</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompetitors.map((competitor) => (
              <div
                key={competitor.id}
                onClick={() => setSelectedCompetitorId(competitor.id)}
                className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50 hover:border-indigo-500/30 transition-all group cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      competitor.perceived_threat_level === 'High'
                        ? 'bg-gradient-to-br from-red-500/30 to-orange-500/30'
                        : competitor.perceived_threat_level === 'Medium'
                        ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/30'
                        : 'bg-gradient-to-br from-gray-500/30 to-slate-500/30'
                    }`}>
                      <Target className={`w-6 h-6 ${
                        competitor.perceived_threat_level === 'High' ? 'text-red-400' :
                        competitor.perceived_threat_level === 'Medium' ? 'text-amber-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg leading-tight">{competitor.name}</h3>
                      {competitor.address && (
                        <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[150px]">{competitor.address}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getThreatColor(competitor.perceived_threat_level)}`}>
                    {competitor.perceived_threat_level === 'High' ? 'גבוה' :
                     competitor.perceived_threat_level === 'Medium' ? 'בינוני' : 'נמוך'}
                  </span>
                </div>

                {/* Rating */}
                {competitor.google_rating ? (
                  <div className="mb-4">
                    <StarRating rating={competitor.google_rating} reviews={competitor.google_reviews_count || 0} />
                  </div>
                ) : (
                  <div className="mb-4 text-gray-500 text-sm">אין דירוג זמין</div>
                )}

                {/* Weakness */}
                {competitor.identified_weakness && (
                  <div className="mb-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <p className="text-red-400 text-xs font-medium mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      חולשה שזוהתה
                    </p>
                    <p className="text-gray-300 text-sm leading-relaxed">{competitor.identified_weakness}</p>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => handleDirectAction(competitor.name)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 px-4 rounded-lg font-medium hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-indigo-500/25"
                >
                  <Zap className="w-4 h-4" />
                  <span>קבל אסטרטגיית תקיפה</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Competitor Detail Drawer */}
      {selectedCompetitorId && (
        <CompetitorDrawer
          competitorId={selectedCompetitorId}
          onClose={() => setSelectedCompetitorId(null)}
        />
      )}
    </div>
  );
}
