import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useSimulation } from '../../context/SimulationContext';
import { loadGoogleMaps } from '../../lib/googleMaps';
import { apiFetch } from '../../services/api';
import { MapPin, Star, Search, Loader2, AlertTriangle, List } from 'lucide-react';
import CompetitorDrawer from '../../components/ui/CompetitorDrawer';

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

interface Competitor {
  id: string;
  name: string;
  place_id?: string;
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

export default function Landscape() {
  const { currentProfile } = useSimulation();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapsReady, setMapsReady] = useState(!!window.google?.maps);

  useEffect(() => {
    if (!mapsReady) {
      loadGoogleMaps().then(() => setMapsReady(true)).catch(() => {});
    }
  }, [mapsReady]);

  useEffect(() => {
    if (currentProfile?.id) fetchCompetitors(currentProfile.id);
  }, [currentProfile?.id]);

  useEffect(() => {
    if (currentProfile?.latitude && currentProfile?.longitude &&
        !(currentProfile.latitude === 0 && currentProfile.longitude === 0)) {
      setMapCenter({ lat: currentProfile.latitude, lng: currentProfile.longitude });
      return;
    }
    if (competitors.length > 0) {
      const valid = competitors.filter(c => c.latitude && c.longitude);
      if (valid.length > 0) {
        const avgLat = valid.reduce((s, c) => s + (c.latitude || 0), 0) / valid.length;
        const avgLng = valid.reduce((s, c) => s + (c.longitude || 0), 0) / valid.length;
        setMapCenter({ lat: avgLat, lng: avgLng });
        return;
      }
    }
    setMapCenter({ lat: 31.77, lng: 35.22 });
  }, [currentProfile?.latitude, currentProfile?.longitude, competitors]);

  const fetchCompetitors = async (businessId: string) => {
    try {
      const response = await apiFetch(`/competitors/${businessId}`);
      if (response.ok) {
        const data = await response.json();
        const seen = new Map<string, Competitor>();
        for (const c of (data.competitors || []) as Competitor[]) {
          const key = (c.place_id || c.name).trim().toLowerCase();
          if (!seen.has(key)) seen.set(key, c);
        }
        setCompetitors(Array.from(seen.values()));
      }
    } catch {
      toast.error('שגיאה בטעינת מתחרים');
    }
  };

  const getDistanceKm = (comp: Competitor): number | null => {
    const bizLat = currentProfile?.latitude;
    const bizLng = currentProfile?.longitude;
    if (!bizLat || !bizLng || !comp.latitude || !comp.longitude) return null;
    const R = 6371;
    const dLat = (comp.latitude - bizLat) * Math.PI / 180;
    const dLon = (comp.longitude - bizLng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(bizLat*Math.PI/180) * Math.cos(comp.latitude*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleScan = async () => {
    if (!currentProfile?.id) return;
    setScanning(true);
    try {
      const res = await apiFetch(`/radar/sync/${currentProfile.id}`, { method: 'POST' });
      if (res.ok) {
        toast.success('סריקה הושלמה!');
        await fetchCompetitors(currentProfile.id);
      }
    } catch {
      toast.error('שגיאה בסריקה');
    } finally {
      setScanning(false);
    }
  };

  const getMarkerColor = useCallback((level: string) => {
    switch (level) {
      case 'High': return '#ef4444';
      case 'Medium': return '#f59e0b';
      default: return '#6b7280';
    }
  }, []);

  const mappableCompetitors = competitors.filter(c => c.latitude && c.longitude);

  // Map init/update — re-run when isMobile changes to re-attach to new container
  useEffect(() => {
    if (!mapsReady || !mapCenter || !mapContainerRef.current || !window.google?.maps) return;

    // If container changed (mobile↔desktop switch), destroy old map
    if (mapInstanceRef.current) {
      const existingContainer = mapInstanceRef.current.getDiv();
      if (existingContainer !== mapContainerRef.current) {
        mapInstanceRef.current = null;
      }
    }

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
        setHighlightedId(null);
      });
    } else {
      mapInstanceRef.current.setCenter(mapCenter);
    }

    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Business marker
    if (currentProfile?.latitude && currentProfile?.longitude) {
      const bizMarker = new window.google.maps.Marker({
        position: { lat: currentProfile.latitude, lng: currentProfile.longitude },
        map,
        title: `${currentProfile.nameHebrew} (אתה)`,
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
        setHighlightedId(comp.id);
        if (!infoWindowRef.current) infoWindowRef.current = new window.google.maps.InfoWindow();
        const threatLabel = comp.perceived_threat_level === 'High' ? 'מתחרה חזק 💪' : comp.perceived_threat_level === 'Medium' ? 'כדאי לעקוב 👀' : 'לא מאיים כרגע 😌';
        infoWindowRef.current.setContent(`
          <div style="color:#e5e7eb; background:#1f2937; padding:10px; border-radius:8px; min-width:180px; direction:rtl;">
            <strong style="color:white;">${comp.name}</strong>
            ${comp.google_rating ? `<div style="margin-top:4px;">⭐ ${comp.google_rating} (${comp.google_reviews_count || 0})</div>` : ''}
            <div style="margin-top:4px; font-size:12px; color:${color};">${threatLabel}</div>
          </div>
        `);
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
    });
  }, [mapsReady, mapCenter, mappableCompetitors, currentProfile?.latitude, currentProfile?.longitude, getMarkerColor, isMobile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        <p className="text-gray-400 mr-3">👁️ עיני סורק את האזור...</p>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        <p className="text-gray-400 mr-3">👁️ עיני סורק את האזור...</p>
      </div>
    );
  }

  // Stats
  const avgRating = competitors.length > 0
    ? (competitors.reduce((s, c) => s + (c.google_rating || 0), 0) / competitors.filter(c => c.google_rating).length).toFixed(1)
    : '—';
  const highThreats = competitors.filter(c => c.perceived_threat_level === 'High').length;
  const topThreats = [...competitors]
    .sort((a, b) => {
      const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
      return (order[a.perceived_threat_level] ?? 2) - (order[b.perceived_threat_level] ?? 2);
    })
    .slice(0, 7);

  const getThreatIcon = (level: string) => {
    if (level === 'High') return '🔴';
    if (level === 'Medium') return '🟡';
    return '🟢';
  };

  const getThreatLabel = (level: string) => {
    if (level === 'High') return 'מתחרה חזק 💪';
    if (level === 'Medium') return 'כדאי לעקוב 👀';
    return 'לא מאיים כרגע 😌';
  };

  return (
    <>
      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div dir="rtl" className="fade-in hidden md:grid" style={{
        height: 'calc(100vh - 60px)',
        gridTemplateAreas: `
          "stats stats"
          "map threats"
          "table table"
        `,
        gridTemplateRows: '46px 1fr 220px',
        gridTemplateColumns: '1fr 260px',
        gap: '12px',
        padding: '16px',
        overflow: 'hidden',
      }}>
        {/* STATS BAR */}
        <div style={{ gridArea: 'stats' }} className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white font-bold text-lg">{competitors.length} מתחרים</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">ממוצע שוק ⭐ {avgRating}</span>
            <span className="text-gray-500">·</span>
            <span className="text-red-400">{highThreats} מתחרים חזקים 💪</span>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20 text-sm transition-colors"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? 'סורק...' : 'סרוק מתחרים'}
          </button>
        </div>

        {/* MAP */}
        <div style={{ gridArea: 'map' }} className="rounded-xl overflow-hidden border border-gray-700/50 relative">
          {mapCenter ? (
            <>
              <div ref={!isMobile ? mapContainerRef : undefined} className="w-full h-full" />
              {!mapsReady && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-gray-900/90 backdrop-blur-sm rounded-lg p-2.5 border border-gray-700 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-gray-300">אתה</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-gray-300">מתחרה חזק 💪</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-gray-300">כדאי לעקוב 👀</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-gray-300">לא מאיים כרגע 😌</span>
                </div>
              </div>
              <div className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-700">
                <span className="text-cyan-400 font-bold text-sm">{mappableCompetitors.length}</span>
                <span className="text-gray-400 text-xs mr-1">על המפה</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
              <MapPin className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* TOP THREATS */}
        <div style={{ gridArea: 'threats' }} className="glass-card p-3 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            המתחרים שלי 👀
          </h3>
          <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
            {topThreats.map(comp => (
              <div
                key={comp.id}
                onClick={() => setSelectedCompetitorId(comp.id)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-sm ${
                  highlightedId === comp.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-gray-800/50'
                }`}
              >
                <span className="flex-shrink-0">{getThreatIcon(comp.perceived_threat_level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{comp.name}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    {comp.google_rating && (
                      <>
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        {comp.google_rating}
                      </>
                    )}
                    {comp.google_reviews_count ? ` (${comp.google_reviews_count})` : ''}
                  </div>
                </div>
              </div>
            ))}
            {topThreats.length === 0 && (
              <div className="text-gray-500 text-xs text-center py-4 whitespace-pre-line">{"עדיין לא מצאתי מתחרים.\nברגע שתגדיר את העסק — אתחיל לסרוק את האזור שלך.\nזה לוקח בדרך כלל כמה דקות 🔍"}</div>
            )}
          </div>
        </div>

        {/* COMPACT TABLE */}
        <div style={{ gridArea: 'table', padding: '12px' }} className="glass-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
            <h3 className="text-sm font-semibold text-white">כל המתחרים</h3>
            <span className="text-xs text-gray-500">{competitors.length} תוצאות</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
                <tr className="text-gray-500 text-xs border-b border-gray-700/50">
                  <th className="text-right py-1 pr-2 font-medium">שם</th>
                  <th className="text-center py-1 font-medium">דירוג</th>
                  <th className="text-center py-1 font-medium">ביקורות</th>
                  <th className="text-center py-1 font-medium">מרחק</th>
                  <th className="text-center py-1 font-medium">רמת איום</th>
                  <th className="text-center py-1 font-medium">חולשה</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map(comp => {
                  const dist = getDistanceKm(comp);
                  return (
                    <tr
                      key={comp.id}
                      onClick={() => setSelectedCompetitorId(comp.id)}
                      className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                        highlightedId === comp.id ? 'bg-cyan-500/10' : 'hover:bg-gray-800/30'
                      }`}
                      style={{ height: '32px' }}
                    >
                      <td className="pr-2 text-white text-xs font-medium truncate max-w-[160px]">{comp.name}</td>
                      <td className="text-center">
                        {comp.google_rating ? (
                          <span className="text-xs text-amber-400">{comp.google_rating}</span>
                        ) : <span className="text-gray-600 text-xs">—</span>}
                      </td>
                      <td className="text-center text-xs text-gray-400">{comp.google_reviews_count || '—'}</td>
                      <td className="text-center text-xs text-gray-400">
                        {dist !== null ? (dist < 1 ? `${Math.round(dist * 1000)}מ` : `${dist.toFixed(1)}ק"מ`) : '—'}
                      </td>
                      <td className="text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          comp.perceived_threat_level === 'High' ? 'bg-red-500/20 text-red-400' :
                          comp.perceived_threat_level === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {getThreatLabel(comp.perceived_threat_level)}
                        </span>
                      </td>
                      <td className="text-center text-[10px] text-gray-500 truncate max-w-[100px]">{comp.identified_weakness || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {competitors.length === 0 && (
              <div className="text-center py-8" dir="rtl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">👁️</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">עדיין לא מצאתי מתחרים.</h3>
                <p className="text-gray-400 text-sm max-w-sm mx-auto whitespace-pre-line">{"ברגע שתגדיר את העסק — אתחיל לסרוק את האזור שלך.\nזה לוקח בדרך כלל כמה דקות 🔍"}</p>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium text-sm hover:from-blue-500 hover:to-cyan-400 transition-all min-h-[44px]"
                >
                  סרוק מתחרים עכשיו
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MOBILE LAYOUT ═══ */}
      <div dir="rtl" className="md:hidden fade-in flex flex-col gap-3 p-3">
        {/* Stats + Scan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-bold">{competitors.length} מתחרים</span>
            <span className="text-gray-500">·</span>
            <span className="text-red-400 text-xs">{highThreats} חזקים 💪</span>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-xs"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {scanning ? 'סורק...' : 'סרוק'}
          </button>
        </div>

        {/* Map/List Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'map' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-gray-800/50 text-gray-400'
            }`}
          >
            <MapPin className="w-4 h-4" />
            מפה
          </button>
          <button
            onClick={() => setMobileView('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mobileView === 'list' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-gray-800/50 text-gray-400'
            }`}
          >
            <List className="w-4 h-4" />
            רשימה
          </button>
        </div>

        {/* Map View */}
        {mobileView === 'map' && (
          <div className="rounded-xl overflow-hidden border border-gray-700/50 relative" style={{ height: '50vh' }}>
            {mapCenter ? (
              <>
                <div ref={isMobile ? mapContainerRef : undefined} className="w-full h-full" />
                {!mapsReady && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                  </div>
                )}
                {/* Compact legend */}
                <div className="absolute bottom-2 left-2 bg-gray-900/90 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-gray-700 flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-gray-400">אתה</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-gray-400">חזק 💪</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-gray-400">לעקוב 👀</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
                <MapPin className="w-10 h-10 text-cyan-400 animate-pulse" />
              </div>
            )}
          </div>
        )}

        {/* List View — Competitor cards */}
        {mobileView === 'list' && (
          <div className="space-y-2">
            {competitors.length === 0 ? (
              <div className="glass-card p-8 text-center" dir="rtl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">👁️</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">עדיין לא מצאתי מתחרים.</h3>
                <p className="text-gray-400 text-sm whitespace-pre-line">{"ברגע שתגדיר את העסק — אתחיל לסרוק את האזור שלך.\nזה לוקח בדרך כלל כמה דקות 🔍"}</p>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium text-sm hover:from-blue-500 hover:to-cyan-400 transition-all min-h-[48px]"
                >
                  סרוק מתחרים עכשיו
                </button>
              </div>
            ) : (
              competitors.map(comp => {
                const dist = getDistanceKm(comp);
                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompetitorId(comp.id)}
                    className="glass-card p-3 active:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0">{getThreatIcon(comp.perceived_threat_level)}</span>
                        <h4 className="text-white text-sm font-medium truncate">{comp.name}</h4>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                        comp.perceived_threat_level === 'High' ? 'bg-red-500/20 text-red-400' :
                        comp.perceived_threat_level === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {getThreatLabel(comp.perceived_threat_level)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {comp.google_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          {comp.google_rating} ({comp.google_reviews_count || 0})
                        </span>
                      )}
                      {dist !== null && (
                        <span>{dist < 1 ? `${Math.round(dist * 1000)}מ` : `${dist.toFixed(1)}ק"מ`}</span>
                      )}
                    </div>
                    {comp.identified_weakness && (
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">חולשה: {comp.identified_weakness}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Top Threats section always visible on mobile */}
        <div className="glass-card p-3">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            המתחרים שלי 👀
          </h3>
          <div className="space-y-1.5">
            {topThreats.slice(0, 5).map(comp => (
              <div
                key={comp.id}
                onClick={() => setSelectedCompetitorId(comp.id)}
                className="flex items-center gap-2 p-2 rounded-lg active:bg-gray-800/50 cursor-pointer text-sm min-h-[44px]"
              >
                <span className="flex-shrink-0">{getThreatIcon(comp.perceived_threat_level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{comp.name}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    {comp.google_rating && (
                      <>
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        {comp.google_rating}
                      </>
                    )}
                    {comp.google_reviews_count ? ` (${comp.google_reviews_count})` : ''}
                  </div>
                </div>
              </div>
            ))}
            {topThreats.length === 0 && (
              <div className="text-gray-500 text-xs text-center py-4 whitespace-pre-line">{"עדיין לא מצאתי מתחרים.\nברגע שתגדיר את העסק — אתחיל לסרוק את האזור שלך.\nזה לוקח בדרך כלל כמה דקות 🔍"}</div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedCompetitorId && (
        <CompetitorDrawer
          competitorId={selectedCompetitorId}
          onClose={() => setSelectedCompetitorId(null)}
        />
      )}
    </>
  );
}
