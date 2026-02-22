import { useState, useEffect } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { MessageSquare, Star, ThumbsUp, ThumbsDown, Copy, Check, Sparkles, Loader2, MessageCircleOff, TrendingUp, TrendingDown, Minus, ListChecks } from 'lucide-react';

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

const smartReplies = {
  apologetic: 'שלום [שם], מצטערים מאוד על החוויה. אנחנו לוקחים את המשוב שלך ברצינות ונשמח לפצות אותך בביקור הבא.',
  thankful: 'תודה רבה על הביקורת! שמחים לשמוע שנהנית. מחכים לראות אותך שוב בקרוב!',
  witty: 'שמחים לשמוע! אנחנו תמיד שואפים להיות הכי טובים בשבילכם.',
};

export default function Reflection() {
  const { currentProfile } = useSimulation();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [copiedReply, setCopiedReply] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch review analysis from backend
  useEffect(() => {
    if (!currentProfile?.id) return;

    const fetchAnalysis = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await fetch(`http://localhost:8015/auditor/analysis/${currentProfile.id}`);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const data: ReviewAnalysis = await response.json();
        setReviewData(data);
      } catch (err) {
        console.error('Failed to fetch review analysis:', err);
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch analysis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [currentProfile?.id]);

  // Loading state
  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-gray-400">טוען ביקורות...</p>
      </div>
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

  // Sentiment derived from analysis or pulse score
  const sentimentScore = reviewData?.overall_score
    ? Math.round(reviewData.overall_score * 10)
    : pulseScore
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

  const handleCopyReply = (type: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedReply(type);
    setTimeout(() => setCopiedReply(null), 2000);
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

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">השתקפות</h1>
        <p className="text-gray-400">מוניטור מוניטין של {nameHebrew} {emoji}</p>
      </header>

      {/* Loading overlay for analysis */}
      {isLoading && (
        <div className="glass-card flex items-center justify-center gap-3 py-6">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <p className="text-gray-400">מנתח ביקורות עם AI...</p>
        </div>
      )}

      {/* Error banner */}
      {fetchError && !isLoading && (
        <div className="glass-card border border-red-500/30 bg-red-500/5 py-4 text-center">
          <p className="text-red-400 text-sm">שגיאה בטעינת ביקורות: {fetchError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Gauge */}
        <div className="lg:col-span-1">
          <div className="glass-card text-center">
            <h2 className="text-lg font-semibold text-white mb-6">ציון בריאות העסק</h2>

            <div className="relative w-40 h-40 mx-auto mb-4">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (sentimentScore / 100) * 251.2}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={"text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent " + getSentimentColor(sentimentScore)}>
                  {sentimentScore}
                </span>
              </div>
            </div>

            {reviews.length > 0 || (sentimentBreakdown.positive + sentimentBreakdown.negative + sentimentBreakdown.neutral) > 0 ? (
              <>
                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-gray-400">
                      {sentimentBreakdown.positive || reviews.filter(r => r.sentiment === 'positive').length} חיוביות
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-4 h-4 text-red-400" />
                    <span className="text-gray-400">
                      {sentimentBreakdown.negative || reviews.filter(r => r.sentiment === 'negative').length} שליליות
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mt-4">מבוסס על {reviewData?.reviews_count || reviews.length} ביקורות</p>
              </>
            ) : (
              <p className="text-gray-500 text-sm">מבוסס על ניתוח AI</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="glass-card mt-4">
            <h3 className="text-white font-medium mb-4">סטטיסטיקה</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ציון בריאות</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{reviewData?.overall_score || pulseScore || '-'}</span>
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ביקורות שנותחו</span>
                <span className="text-white font-medium">{reviewData?.reviews_count || reviews.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">נושאים שזוהו</span>
                <span className="text-white font-medium">{themes.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">סטטוס</span>
                <span className="text-emerald-400 font-medium">
                  {isLoading ? 'מנתח...' : reviewData?.success ? 'נותח' : 'פעיל'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">

          {/* Review Themes Section */}
          {themes.length > 0 && (
            <div className="glass-card">
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
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">אזכורים: {theme.frequency}</span>
                    </div>
                    {theme.examples && theme.examples.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700/30">
                        <p className="text-gray-500 text-xs mb-1">ציטוטים:</p>
                        {theme.examples.slice(0, 2).map((ex, exIdx) => (
                          <p key={exIdx} className="text-gray-400 text-xs italic mr-2">"{ex.length > 80 ? ex.slice(0, 80) + '...' : ex}"</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Suggestions Section */}
          {improvementSuggestions.length > 0 && (
            <div className="glass-card">
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

              {/* Strengths / Weaknesses summary */}
              {(reviewData?.strengths_summary || reviewData?.weaknesses_summary) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-700/30">
                  {reviewData?.strengths_summary && (
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <ThumbsUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-medium text-sm">חוזקות</span>
                      </div>
                      <p className="text-gray-300 text-sm">{reviewData.strengths_summary}</p>
                    </div>
                  )}
                  {reviewData?.weaknesses_summary && (
                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <ThumbsDown className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 font-medium text-sm">נקודות לשיפור</span>
                      </div>
                      <p className="text-gray-300 text-sm">{reviewData.weaknesses_summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reviews Feed */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">ביקורות אחרונות</h2>
              </div>
              <div className="flex gap-2">
                {['google', 'facebook', 'easy'].map((source) => (
                  <button
                    key={source}
                    className="px-3 py-1 rounded-full bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 transition-colors"
                  >
                    {getSourceIcon(source)}
                  </button>
                ))}
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircleOff className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {isLoading ? 'טוען ביקורות...' : 'אין ביקורות להצגה כרגע'}
                </p>
                <p className="text-gray-500 text-sm mt-2">ביקורות מ-Google יופיעו כאן בקרוב</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className={"p-4 rounded-xl transition-all cursor-pointer " + (selectedReview?.id === review.id ? "bg-indigo-500/10 border border-indigo-500/30" : "bg-gray-800/50 hover:bg-gray-800/70")}
                    onClick={() => setSelectedReview(selectedReview?.id === review.id ? null : review)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
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
                      <span className={"px-2 py-1 rounded-full text-xs " + (review.sentiment === 'positive' ? "bg-emerald-500/20 text-emerald-400" : review.sentiment === 'negative' ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400")}>
                        {review.sentiment === 'positive' ? 'חיובי' : review.sentiment === 'negative' ? 'שלילי' : 'ניטרלי'}
                      </span>
                    </div>

                    <p className="text-gray-300">{review.text}</p>

                    {/* Smart Reply Section */}
                    {selectedReview?.id === review.id && (
                      <div className="mt-4 pt-4 border-t border-gray-700/50 fade-in">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          <span className="text-indigo-400 font-medium text-sm">תגובות חכמות</span>
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
                                className="mr-3 p-2 rounded-lg bg-indigo-500/20 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {copiedReply === type ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
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
          </div>
        </div>
      </div>
    </div>
  );
}
