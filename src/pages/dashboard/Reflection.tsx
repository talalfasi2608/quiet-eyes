import { useState, useEffect } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquare, Star, ThumbsUp, ThumbsDown, Copy, Check, Sparkles,
  Loader2, MessageCircleOff, TrendingUp, TrendingDown, Minus, ListChecks,
  BarChart3, Users, Shield, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import PageLoader from '../../components/ui/PageLoader';
import EmptyState from '../../components/ui/EmptyState';

interface Review {
  id: string;
  source: 'google' | 'facebook' | 'easy';
  author: string;
  rating: number;
  text: string;
  date: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface ReviewTheme {
  theme: string;
  theme_english: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  frequency: number;
  examples: string[];
  description: string;
}

interface ReviewAnalysis {
  success: boolean;
  business_name: string;
  reviews_count: number;
  reviews: Array<{
    author: string;
    rating: number;
    text: string;
    relative_publish_time: string;
    author_photo: string;
  }>;
  themes: ReviewTheme[];
  overall_sentiment: string;
  sentiment_breakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  overall_score: number;
  improvement_suggestions: string[];
  strengths_summary: string;
  weaknesses_summary: string;
  error?: string;
}

interface Competitor {
  id: string;
  name: string;
  google_rating: number | null;
  google_reviews_count: number | null;
  perceived_threat_level: string | null;
  identified_weakness: string | null;
}

const smartReplies = {
  apologetic: 'שלום [שם], מצטערים מאוד על החוויה. אנחנו לוקחים את המשוב שלך ברצינות ונשמח לפצות אותך בביקור הבא.',
  thankful: 'תודה רבה על הביקורת! שמחים לשמוע שנהנית. מחכים לראות אותך שוב בקרוב!',
  witty: 'שמחים לשמוע! אנחנו תמיד שואפים להיות הכי טובים בשבילכם.',
};

export default function Reflection() {
  const { currentProfile } = useSimulation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [copiedReply, setCopiedReply] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewAnalysis | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch review analysis + competitors
  useEffect(() => {
    if (!currentProfile?.id || !user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchAll = async () => {
      setIsLoading(true);
      setFetchError(null);

      // Fetch both in parallel
      const [analysisRes, competitorsRes] = await Promise.allSettled([
        apiFetch(`/auditor/analysis/${currentProfile.id}`),
        apiFetch(`/intelligence/history/business/${user.id}?days=90`),
      ]);

      // Process analysis
      if (analysisRes.status === 'fulfilled' && analysisRes.value.ok) {
        try {
          const data: ReviewAnalysis = await analysisRes.value.json();
          setReviewData(data);
        } catch {
          setFetchError('שגיאה בפענוח נתוני ביקורות');
        }
      } else {
        setFetchError('שגיאה בטעינת ביקורות');
      }

      // Process competitors
      if (competitorsRes.status === 'fulfilled' && competitorsRes.value.ok) {
        try {
          const data = await competitorsRes.value.json();
          setCompetitors(data.competitors || []);
        } catch { /* ignore */ }
      }

      setIsLoading(false);
    };

    fetchAll();
  }, [currentProfile?.id, user?.id]);

  // Loading state
  if (!currentProfile) {
    return (
      <PageLoader message="טוען ביקורות..." />
    );
  }

  const { nameHebrew, emoji, pulseScore } = currentProfile;

  // Build reviews array from API response
  const reviews: Review[] = (reviewData?.reviews || []).map((r, idx) => ({
    id: `review-${idx}`,
    source: 'google' as const,
    author: r.author || 'Anonymous',
    rating: r.rating || 0,
    text: r.text || '',
    date: r.relative_publish_time || '',
    sentiment: r.rating >= 4 ? 'positive' : r.rating <= 2 ? 'negative' : 'neutral',
  }));

  const sentimentScore = reviewData?.overall_score && !isNaN(reviewData.overall_score)
    ? Math.round(reviewData.overall_score)
    : pulseScore && !isNaN(pulseScore)
      ? Math.round(pulseScore * 10)
      : 0;

  const themes = reviewData?.themes || [];
  const improvementSuggestions = reviewData?.improvement_suggestions || [];
  const sentimentBreakdown = reviewData?.sentiment_breakdown || { positive: 0, negative: 0, neutral: 0 };

  const getSentimentColor = (score: number) => {
    if (score >= 70) return 'from-emerald-500 to-green-400';
    if (score >= 40) return 'from-amber-500 to-yellow-400';
    return 'from-red-500 to-orange-400';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'google': return '🔍';
      case 'facebook': return '📘';
      default: return '⭐';
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
            <TrendingUp className="w-3 h-3" /> חיובי
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
            <TrendingDown className="w-3 h-3" /> שלילי
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">
            <Minus className="w-3 h-3" /> ניטרלי
          </span>
        );
    }
  };

  const handleCopyReply = async (type: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReply(type);
      toast.success('הועתק!');
      setTimeout(() => setCopiedReply(null), 2000);
    } catch {
      toast.error('לא ניתן להעתיק');
    }
  };

  const renderStars = (rating: number) => {
    return Array(5)
      .fill(0)
      .map((_, i) => (
        <Star
          key={i}
          className={"w-4 h-4 " + (i < rating ? "text-amber-400 fill-amber-400" : "text-gray-600")}
        />
      ));
  };

  // Competitor data sorted by rating
  const sortedCompetitors = [...competitors]
    .filter(c => c.google_rating != null)
    .sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0));

  const threatLevelColor = (level: string | null) => {
    if (!level) return 'text-gray-400';
    const l = level.toLowerCase();
    if (l === 'high') return 'text-red-400';
    if (l === 'medium') return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      <header>
        <h1 className="text-3xl font-bold text-white mb-1">איך נראה בעיני הלקוחות?</h1>
        <p className="text-gray-400">{nameHebrew} {emoji} — ניתוח מוניטין ותחרות</p>
      </header>

      {/* Loading overlay */}
      {isLoading && (
        <div className="glass-card flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          <p className="text-gray-400">מנתח ביקורות ומתחרים עם AI...</p>
        </div>
      )}

      {fetchError && !isLoading && (
        <div className="glass-card border border-red-500/30 bg-red-500/5 py-4 text-center">
          <p className="text-red-400 text-sm">{fetchError}</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* ═══ TOP ROW: Score + Competitor Comparison ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sentiment Gauge */}
            <div className="lg:col-span-1">
              <div className="glass-card text-center">
                <h2 className="text-lg font-semibold text-white mb-4">ציון בריאות המותג</h2>

                <div className="relative w-36 h-36 mx-auto mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="12" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke="url(#gradient)" strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (sentimentScore / 100) * 251.2}
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={"text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent " + getSentimentColor(sentimentScore)}>
                      {sentimentScore}
                    </span>
                  </div>
                </div>

                <div className="flex justify-center gap-4 text-sm mb-3">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-gray-400 text-xs">{sentimentBreakdown.positive}% חיובי</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsDown className="w-3 h-3 text-red-400" />
                    <span className="text-gray-400 text-xs">{sentimentBreakdown.negative}% שלילי</span>
                  </div>
                </div>

                <p className="text-gray-500 text-xs">
                  {reviewData?.reviews_count ? `מבוסס על ${reviewData.reviews_count} ביקורות` : 'מבוסס על ניתוח AI'}
                </p>
              </div>

              {/* Strengths / Weaknesses */}
              {(reviewData?.strengths_summary || reviewData?.weaknesses_summary) && (
                <div className="glass-card mt-4 space-y-3">
                  {reviewData?.strengths_summary && (
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <ThumbsUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-medium text-sm">חוזקות</span>
                      </div>
                      <p className="text-gray-300 text-sm">{reviewData.strengths_summary}</p>
                    </div>
                  )}
                  {reviewData?.weaknesses_summary && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <ThumbsDown className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 font-medium text-sm">נקודות לשיפור</span>
                      </div>
                      <p className="text-gray-300 text-sm">{reviewData.weaknesses_summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Competitor Comparison Table */}
            <div className="lg:col-span-2">
              <div className="glass-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">השוואה למתחרים</h2>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard/landscape')}
                    className="text-cyan-400 text-sm hover:text-cyan-300 flex items-center gap-1"
                  >
                    נוף מלא
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {sortedCompetitors.length === 0 ? (
                  <EmptyState icon={Users} title="אין מתחרים שנסרקו עדיין" description="הוסף מתחרים כדי להשוות" actionLabel="הוסף מתחרים" onAction={() => navigate('/dashboard/landscape')} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="text-right text-gray-400 font-medium py-2 px-2">מתחרה</th>
                          <th className="text-center text-gray-400 font-medium py-2 px-2">דירוג</th>
                          <th className="text-center text-gray-400 font-medium py-2 px-2">ביקורות</th>
                          <th className="text-center text-gray-400 font-medium py-2 px-2">רמת איום</th>
                          <th className="text-right text-gray-400 font-medium py-2 px-2">חולשה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Our business row */}
                        <tr className="border-b border-cyan-500/20 bg-cyan-500/5">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-cyan-400" />
                              <span className="text-cyan-400 font-semibold">{nameHebrew} (אתה)</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-white font-medium">
                                {reviewData?.reviews?.length
                                  ? (reviewData.reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewData.reviews.length).toFixed(1)
                                  : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="text-center text-white py-3 px-2">{reviewData?.reviews_count || '-'}</td>
                          <td className="text-center py-3 px-2">—</td>
                          <td className="text-gray-500 py-3 px-2 text-xs">—</td>
                        </tr>
                        {sortedCompetitors.slice(0, 8).map((comp) => (
                          <tr key={comp.id} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                            <td className="py-3 px-2">
                              <span className="text-white">{comp.name}</span>
                            </td>
                            <td className="text-center py-3 px-2">
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span className="text-white">{comp.google_rating?.toFixed(1) || '-'}</span>
                              </div>
                            </td>
                            <td className="text-center text-gray-400 py-3 px-2">{comp.google_reviews_count || '-'}</td>
                            <td className="text-center py-3 px-2">
                              <span className={`text-xs font-medium ${threatLevelColor(comp.perceived_threat_level)}`}>
                                {comp.perceived_threat_level === 'high' ? 'גבוה' :
                                 comp.perceived_threat_level === 'medium' ? 'בינוני' :
                                 comp.perceived_threat_level === 'low' ? 'נמוך' : '-'}
                              </span>
                            </td>
                            <td className="text-gray-500 py-3 px-2 text-xs max-w-[200px] truncate">
                              {comp.identified_weakness || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ WORD CLOUD from Themes ═══ */}
          {themes.length > 0 && (
            <section className="glass-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">מפת נושאים</h2>
              </div>

              <div className="flex flex-wrap gap-3 justify-center py-4">
                {themes.map((theme, idx) => {
                  const size = Math.max(14, Math.min(28, 14 + theme.frequency * 3));
                  const colorClass = theme.sentiment === 'positive'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : theme.sentiment === 'negative'
                      ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : 'text-gray-300 bg-gray-500/10 border-gray-500/20';
                  return (
                    <span
                      key={idx}
                      className={`px-3 py-1.5 rounded-full border transition-all hover:scale-105 cursor-default ${colorClass}`}
                      style={{ fontSize: `${size}px` }}
                      title={theme.description}
                    >
                      {theme.theme}
                      <span className="text-xs opacity-60 mr-1">({theme.frequency})</span>
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ THEMES DETAIL ═══ */}
          {themes.length > 0 && (
            <section className="glass-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">נושאים מרכזיים</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {themes.map((theme, idx) => (
                  <div
                    key={idx}
                    className={"p-4 rounded-xl border " + (
                      theme.sentiment === 'positive'
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : theme.sentiment === 'negative'
                          ? "bg-red-500/5 border-red-500/20"
                          : "bg-gray-500/5 border-gray-500/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-medium text-sm">{theme.theme}</h3>
                      {getSentimentBadge(theme.sentiment)}
                    </div>
                    <p className="text-gray-400 text-xs mb-3">{theme.description}</p>
                    <span className="text-gray-500 text-xs">אזכורים: {theme.frequency}</span>
                    {theme.examples?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700/30">
                        <p className="text-gray-500 text-xs mb-1">ציטוטים:</p>
                        {theme.examples.slice(0, 2).map((ex, exIdx) => (
                          <p key={exIdx} className="text-gray-400 text-xs italic mr-2">
                            "{ex.length > 80 ? ex.slice(0, 80) + '...' : ex}"
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ IMPROVEMENT PLAN ═══ */}
          {improvementSuggestions.length > 0 && (
            <section className="glass-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">תוכנית שיפור</h2>
              </div>

              <div className="space-y-3">
                {improvementSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <p className="text-gray-300 text-sm">{suggestion}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ REVIEWS FEED ═══ */}
          <section className="glass-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">ביקורות אחרונות</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSourceFilter(sourceFilter === 'google' ? null : 'google')}
                  className={"px-3 py-1 rounded-full text-sm transition-colors " + (
                    sourceFilter === 'google'
                      ? "bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-500/50"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  )}
                >
                  {getSourceIcon('google')} Google
                </button>
              </div>
            </div>

            {(sourceFilter ? reviews.filter(r => r.source === sourceFilter) : reviews).length === 0 ? (
              <EmptyState icon={MessageCircleOff} title="אין ביקורות להצגה" description="ביקורות מ-Google יופיעו כאן בקרוב" />
            ) : (
              <div className="space-y-4">
                {(sourceFilter ? reviews.filter(r => r.source === sourceFilter) : reviews).map((review) => (
                  <div
                    key={review.id}
                    className={"p-4 rounded-xl transition-all cursor-pointer " + (
                      selectedReview?.id === review.id
                        ? "bg-cyan-500/10 border border-cyan-500/30"
                        : "bg-gray-800/50 hover:bg-gray-800/70"
                    )}
                    onClick={() => setSelectedReview(selectedReview?.id === review.id ? null : review)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-medium">
                          {review.author.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{review.author}</span>
                            <span>{getSourceIcon(review.source)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">{renderStars(review.rating)}</div>
                            <span className="text-gray-500 text-sm">• {review.date}</span>
                          </div>
                        </div>
                      </div>
                      <span className={"px-2 py-1 rounded-full text-xs " + (
                        review.sentiment === 'positive' ? "bg-emerald-500/20 text-emerald-400" :
                        review.sentiment === 'negative' ? "bg-red-500/20 text-red-400" :
                        "bg-gray-500/20 text-gray-400"
                      )}>
                        {review.sentiment === 'positive' ? 'חיובי' : review.sentiment === 'negative' ? 'שלילי' : 'ניטרלי'}
                      </span>
                    </div>

                    <p className="text-gray-300">{review.text}</p>

                    {/* Smart Reply Section */}
                    {selectedReview?.id === review.id && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50 fade-in">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <span className="text-cyan-400 font-medium text-sm">תגובות חכמות</span>
                        </div>

                        <div className="space-y-2">
                          {Object.entries(smartReplies).map(([type, text]) => (
                            <div
                              key={type}
                              className="flex items-start justify-between p-3 rounded-lg bg-gray-900/50 group"
                            >
                              <div className="flex-1">
                                <span className="text-xs text-gray-500 block mb-1">
                                  {type === 'apologetic' ? 'התנצלותי' : type === 'thankful' ? 'מודה' : 'חיובי'}
                                </span>
                                <p className="text-gray-300 text-sm">{text.replace('[שם]', review.author.split(' ')[0])}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyReply(type, text.replace('[שם]', review.author.split(' ')[0]));
                                }}
                                className="mr-3 p-2 rounded-lg bg-cyan-500/20 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {copiedReply === type ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
