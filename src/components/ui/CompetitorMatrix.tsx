import { useState, useEffect, useCallback } from 'react';
import {
  Star,
  Globe,
  Instagram,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Sparkles,
  Crown,
  Target,
  BarChart3,
  Users
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { apiFetch } from '../../services/api';

interface CompetitorData {
  id: string;
  name: string;
  google_rating?: number;
  google_reviews_count?: number;
  website?: string;
  web_intelligence?: string;
  perceived_threat_level?: string;
  price_positioning?: string;
  social_strategy?: string;
}

interface MatrixEntry {
  id: string;
  name: string;
  isUser: boolean;
  trustScore: number;
  trustLabel: string;
  digitalPresence: {
    score: number;
    hasWebsite: boolean;
    hasInstagram: boolean;
    hasFacebook: boolean;
  };
  marketSentiment: 'positive' | 'negative' | 'mixed' | 'neutral' | 'unknown';
  sentimentDetails: string;
  pricePositioning: 'budget' | 'mid' | 'premium' | 'unknown';
  threatLevel: string;
  webIntelligence?: any;
}

interface CompetitorMatrixProps {
  businessId: string;
  businessName: string;
  businessRating?: number;
  businessReviews?: number;
}

// Score badge component with color coding
function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const getColor = () => {
    if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (score >= 40) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getColor()}`}>
      <span className="font-bold text-lg">{score}</span>
      {label && <span className="text-xs opacity-80">{label}</span>}
    </div>
  );
}

// Progress bar component
function ProgressBar({ value, max = 100, color = 'indigo' }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100);

  const getColorClass = () => {
    if (color === 'auto') {
      if (percentage >= 80) return 'from-emerald-500 to-emerald-400';
      if (percentage >= 60) return 'from-amber-500 to-amber-400';
      if (percentage >= 40) return 'from-orange-500 to-orange-400';
      return 'from-red-500 to-red-400';
    }
    return `from-${color}-500 to-${color}-400`;
  };

  return (
    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${getColorClass()} rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// Sentiment indicator
function SentimentBadge({ sentiment, details }: { sentiment: string; details?: string }) {
  const config = {
    positive: { icon: TrendingUp, color: 'text-emerald-400 bg-emerald-500/20', label: 'חיובי' },
    negative: { icon: TrendingDown, color: 'text-red-400 bg-red-500/20', label: 'שלילי' },
    mixed: { icon: Minus, color: 'text-amber-400 bg-amber-500/20', label: 'מעורב' },
    neutral: { icon: Minus, color: 'text-gray-400 bg-gray-500/20', label: 'ניטרלי' },
    unknown: { icon: Search, color: 'text-gray-500 bg-gray-700/50', label: 'לא ידוע' }
  };

  const { icon: Icon, color, label } = config[sentiment as keyof typeof config] || config.unknown;

  return (
    <div className="group relative">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {details && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-xs">
          {details}
        </div>
      )}
    </div>
  );
}

// Price positioning badge
function PriceBadge({ positioning }: { positioning: string }) {
  const config = {
    budget: { icon: DollarSign, color: 'text-blue-400 bg-blue-500/20', label: 'תקציבי', dollars: 1 },
    mid: { icon: DollarSign, color: 'text-amber-400 bg-amber-500/20', label: 'בינוני', dollars: 2 },
    premium: { icon: Crown, color: 'text-cyan-400 bg-cyan-500/20', label: 'פרימיום', dollars: 3 },
    unknown: { icon: DollarSign, color: 'text-gray-500 bg-gray-700/50', label: 'לא ידוע', dollars: 0 }
  };

  const { color, label, dollars } = config[positioning as keyof typeof config] || config.unknown;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${color}`}>
      <div className="flex">
        {[1, 2, 3].map((i) => (
          <DollarSign
            key={i}
            className={`w-3 h-3 ${i <= dollars ? 'opacity-100' : 'opacity-30'}`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// Digital presence indicator
function DigitalPresenceCell({ presence }: { presence: MatrixEntry['digitalPresence'] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <ScoreBadge score={presence.score} />
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`p-1.5 rounded ${presence.hasWebsite ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/50 text-gray-500'}`}
          title={presence.hasWebsite ? 'יש אתר' : 'אין אתר'}
        >
          <Globe className="w-4 h-4" />
        </div>
        <div
          className={`p-1.5 rounded ${presence.hasInstagram ? 'bg-pink-500/20 text-pink-400' : 'bg-gray-700/50 text-gray-500'}`}
          title={presence.hasInstagram ? 'יש אינסטגרם' : 'אין אינסטגרם'}
        >
          <Instagram className="w-4 h-4" />
        </div>
        <div
          className={`p-1.5 rounded ${presence.hasFacebook ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-500'}`}
          title={presence.hasFacebook ? 'יש פייסבוק' : 'אין פייסבוק'}
        >
          <Users className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function CompetitorMatrix({
  businessId,
  businessName,
  businessRating = 0,
  businessReviews = 0
}: CompetitorMatrixProps) {
  const [matrixData, setMatrixData] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch and build matrix data
  useEffect(() => {
    if (businessId) {
      fetchMatrixData();
    }
  }, [businessId]);

  const fetchMatrixData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch competitors
      const response = await apiFetch(`/competitors/${businessId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch competitors');
      }

      const data = await response.json();
      const competitors: CompetitorData[] = data.competitors || [];

      // Build matrix entries
      const entries: MatrixEntry[] = [];

      // Add user's business first
      entries.push({
        id: 'user',
        name: businessName,
        isUser: true,
        trustScore: calculateTrustScore(businessRating, businessReviews),
        trustLabel: `${businessRating.toFixed(1)} (${businessReviews})`,
        digitalPresence: {
          score: 70, // Default for user
          hasWebsite: true,
          hasInstagram: true,
          hasFacebook: true
        },
        marketSentiment: 'positive',
        sentimentDetails: 'העסק שלך',
        pricePositioning: 'mid',
        threatLevel: 'user'
      });

      // Add top 3 competitors (sorted by threat level)
      const sortedCompetitors = competitors
        .sort((a, b) => {
          const threatOrder: Record<string, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
          return (threatOrder[a.perceived_threat_level || 'Low'] || 2) -
                 (threatOrder[b.perceived_threat_level || 'Low'] || 2);
        })
        .slice(0, 3);

      for (const comp of sortedCompetitors) {
        const webIntel = parseWebIntelligence(comp.web_intelligence);
        const socialStrategy = parseSocialStrategy(comp.social_strategy);

        entries.push({
          id: comp.id,
          name: comp.name,
          isUser: false,
          trustScore: calculateTrustScore(comp.google_rating || 0, comp.google_reviews_count || 0),
          trustLabel: `${(comp.google_rating || 0).toFixed(1)} (${comp.google_reviews_count || 0})`,
          digitalPresence: {
            score: calculateDigitalScore(comp.website, webIntel, socialStrategy),
            hasWebsite: !!comp.website || !!webIntel?.website_url,
            hasInstagram: !!socialStrategy?.instagram || webIntel?.services?.some((s: string) => s.toLowerCase().includes('instagram')),
            hasFacebook: !!socialStrategy?.facebook || webIntel?.services?.some((s: string) => s.toLowerCase().includes('facebook'))
          },
          marketSentiment: webIntel?.public_sentiment || 'unknown',
          sentimentDetails: webIntel?.sentiment_details || '',
          pricePositioning: determinePricePositioning(webIntel, socialStrategy),
          threatLevel: comp.perceived_threat_level || 'Low',
          webIntelligence: webIntel
        });
      }

      setMatrixData(entries);
    } catch (err) {
      setError('Failed to load competitor matrix');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const calculateTrustScore = (rating: number, reviews: number): number => {
    // Trust score formula: (rating * 15) + log(reviews + 1) * 5
    // Max score: 100
    const ratingScore = Math.min(rating * 15, 75);
    const reviewScore = Math.min(Math.log10(reviews + 1) * 10, 25);
    return Math.round(ratingScore + reviewScore);
  };

  const calculateDigitalScore = (website?: string, webIntel?: any, social?: any): number => {
    let score = 0;
    if (website || webIntel?.website_url) score += 40;
    if (social?.instagram || webIntel?.services?.some((s: string) => s.toLowerCase().includes('instagram'))) score += 25;
    if (social?.facebook || webIntel?.services?.some((s: string) => s.toLowerCase().includes('facebook'))) score += 20;
    if (webIntel?.services?.length > 0) score += 15;
    return Math.min(score, 100);
  };

  const parseWebIntelligence = (jsonStr?: string): any => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const parseSocialStrategy = (jsonStr?: string): any => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const determinePricePositioning = (webIntel?: any, social?: any): 'budget' | 'mid' | 'premium' | 'unknown' => {
    // Check web intelligence for price indicators
    const keywords = (webIntel?.sentiment_details || '').toLowerCase();

    if (keywords.includes('premium') || keywords.includes('יוקרה') || keywords.includes('luxury')) {
      return 'premium';
    }
    if (keywords.includes('budget') || keywords.includes('זול') || keywords.includes('cheap') || keywords.includes('מבצע')) {
      return 'budget';
    }
    if (keywords.includes('quality') || keywords.includes('איכות')) {
      return 'mid';
    }

    return 'unknown';
  };

  // Deep dive handler - opens AI chat with competitor data
  const handleDeepDive = useCallback((entry: MatrixEntry) => {
    const message = `תן לי ניתוח מעמיק על המתחרה "${entry.name}".
מידע שיש לי:
- ציון אמון: ${entry.trustScore}
- נוכחות דיגיטלית: ${entry.digitalPresence.score}
- סנטימנט שוק: ${entry.marketSentiment}
- מיצוב מחיר: ${entry.pricePositioning}

אנא תן לי:
1. ניתוח חולשות שאפשר לנצל
2. אסטרטגיות לגנוב לקוחות
3. בידול מומלץ מולם`;

    const event = new CustomEvent('openAiChat', {
      detail: { message }
    });
    window.dispatchEvent(event);
  }, []);

  // Research competitor with Tavily
  const handleResearch = async (competitorId: string) => {
    setResearching(competitorId);
    try {
      await apiFetch(`/research/competitor/${competitorId}`, {
        method: 'POST'
      });
      // Refresh data after a delay
      setTimeout(() => {
        fetchMatrixData();
        setResearching(null);
      }, 5000);
    } catch (err) {
      setResearching(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="glass-card p-8 rounded-xl">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="text-gray-400">טוען מטריצת תחרות...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="glass-card p-8 rounded-xl border border-red-500/30">
        <div className="text-center text-red-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{error}</p>
          <button
            onClick={fetchMatrixData}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (matrixData.length <= 1) {
    return (
      <div className="glass-card p-8 rounded-xl">
        <div className="text-center text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>לא נמצאו מתחרים להשוואה</p>
          <p className="text-sm mt-2">הפעל את רדאר השוק כדי לזהות מתחרים</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">מטריצת תחרות</h3>
              <p className="text-sm text-gray-400">השוואה מול {matrixData.length - 1} מתחרים מובילים</p>
            </div>
          </div>
          <button
            onClick={fetchMatrixData}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
            title="רענן נתונים"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm">עסק</th>
              <th className="text-center py-4 px-6 text-gray-400 font-medium text-sm">
                <div className="flex items-center justify-center gap-2">
                  <Star className="w-4 h-4" />
                  <span>ציון אמון</span>
                </div>
              </th>
              <th className="text-center py-4 px-6 text-gray-400 font-medium text-sm">
                <div className="flex items-center justify-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>נוכחות דיגיטלית</span>
                </div>
              </th>
              <th className="text-center py-4 px-6 text-gray-400 font-medium text-sm">
                <div className="flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>סנטימנט שוק</span>
                </div>
              </th>
              <th className="text-center py-4 px-6 text-gray-400 font-medium text-sm">
                <div className="flex items-center justify-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>מיצוב מחיר</span>
                </div>
              </th>
              <th className="text-center py-4 px-6 text-gray-400 font-medium text-sm">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.map((entry, index) => (
              <tr
                key={entry.id}
                className={`border-b border-gray-700/30 transition-colors ${
                  entry.isUser
                    ? 'bg-indigo-500/10'
                    : 'hover:bg-gray-800/30'
                }`}
              >
                {/* Business Name */}
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    {entry.isUser ? (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        entry.threatLevel === 'High'
                          ? 'bg-red-500/20 text-red-400'
                          : entry.threatLevel === 'Medium'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-gray-700/50 text-gray-400'
                      }`}>
                        <Target className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        {entry.name}
                        {entry.isUser && (
                          <span className="px-2 py-0.5 text-xs bg-indigo-500/30 text-indigo-300 rounded-full">
                            אתה
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.isUser ? 'העסק שלך' : entry.trustLabel}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Trust Score */}
                <td className="py-4 px-6">
                  <div className="flex flex-col items-center gap-2">
                    <ScoreBadge score={entry.trustScore} />
                    <ProgressBar value={entry.trustScore} color="auto" />
                  </div>
                </td>

                {/* Digital Presence */}
                <td className="py-4 px-6">
                  <div className="flex justify-center">
                    <DigitalPresenceCell presence={entry.digitalPresence} />
                  </div>
                </td>

                {/* Market Sentiment */}
                <td className="py-4 px-6">
                  <div className="flex justify-center">
                    <SentimentBadge
                      sentiment={entry.marketSentiment}
                      details={entry.sentimentDetails}
                    />
                  </div>
                </td>

                {/* Price Positioning */}
                <td className="py-4 px-6">
                  <div className="flex justify-center">
                    <PriceBadge positioning={entry.pricePositioning} />
                  </div>
                </td>

                {/* Actions */}
                <td className="py-4 px-6">
                  <div className="flex items-center justify-center gap-2">
                    {!entry.isUser && (
                      <>
                        {/* Research Button */}
                        <button
                          onClick={() => handleResearch(entry.id)}
                          disabled={researching === entry.id}
                          className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors disabled:opacity-50"
                          title="חקור באינטרנט"
                        >
                          {researching === entry.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </button>

                        {/* Deep Dive Button */}
                        <button
                          onClick={() => handleDeepDive(entry)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span className="text-sm">צלילה עמוקה</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {entry.isUser && (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-700/50 bg-gray-800/30">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>80+ מצוין</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>60-79 טוב</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>40-59 בינוני</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>0-39 חלש</span>
          </div>
        </div>
      </div>
    </div>
  );
}
