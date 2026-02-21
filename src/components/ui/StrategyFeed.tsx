import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lightbulb,
  MessageCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  MapPin,
  Globe,
  Instagram,
  Star,
  ChevronRight,
  Zap,
  X,
  History
} from 'lucide-react';

interface OpportunityCard {
  id: string;
  business_id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  source: string;
  category: string;
  is_dismissed: boolean;
  is_actioned: boolean;
  created_at: string;
  expires_at: string;
  generation_id: string;
}

interface FeedResponse {
  success: boolean;
  business_name: string;
  cached: boolean;
  generation_id?: string;
  competitors_analyzed?: number;
  intelligence_sources?: number;
  cards_count: number;
  cards: OpportunityCard[];
}

// Priority configuration with colors
const priorityConfig: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  label: string;
  icon: string;
}> = {
  High: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-red-500/20',
    label: 'עדיפות גבוהה',
    icon: '🔴'
  },
  Medium: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-amber-500/20',
    label: 'עדיפות בינונית',
    icon: '🟡'
  },
  Low: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-blue-500/20',
    label: 'עדיפות נמוכה',
    icon: '🔵'
  },
};

function getSourceIcon(source: string) {
  if (source.toLowerCase().includes('google')) return Star;
  if (source.toLowerCase().includes('easy')) return Globe;
  if (source.toLowerCase().includes('instagram')) return Instagram;
  if (source.toLowerCase().includes('madlan')) return MapPin;
  return Lightbulb;
}

function getSourceColor(source: string) {
  if (source.toLowerCase().includes('google')) return 'text-yellow-400';
  if (source.toLowerCase().includes('easy')) return 'text-green-400';
  if (source.toLowerCase().includes('instagram')) return 'text-pink-400';
  if (source.toLowerCase().includes('madlan')) return 'text-blue-400';
  return 'text-purple-400';
}

// Single Opportunity Card Component
function OpportunityCardItem({
  card,
  onExplainMore,
  onMarkDone,
  isProcessing
}: {
  card: OpportunityCard;
  onExplainMore: (card: OpportunityCard) => void;
  onMarkDone: (cardId: string) => void;
  isProcessing: boolean;
}) {
  const priority = priorityConfig[card.priority] || priorityConfig.Medium;
  const SourceIcon = getSourceIcon(card.source);
  const sourceColor = getSourceColor(card.source);

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'עכשיו';
    if (diffHours < 24) return `לפני ${diffHours} שע׳`;
    const diffDays = Math.floor(diffHours / 24);
    return `לפני ${diffDays} ימים`;
  };

  return (
    <div
      className={`
        relative group
        bg-gradient-to-br from-gray-800/80 to-gray-900/80
        backdrop-blur-sm
        border ${priority.borderColor}
        rounded-2xl
        p-5
        transition-all duration-300
        hover:shadow-lg hover:${priority.glowColor}
        hover:border-opacity-60
        hover:scale-[1.01]
      `}
    >
      {/* Priority Indicator Bar */}
      <div
        className={`
          absolute top-0 left-0 right-0 h-1
          rounded-t-2xl
          ${card.priority === 'High' ? 'bg-gradient-to-r from-red-500 to-orange-500' : ''}
          ${card.priority === 'Medium' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : ''}
          ${card.priority === 'Low' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : ''}
        `}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Source Icon */}
          <div className={`
            p-2.5 rounded-xl
            ${card.priority === 'High' ? 'bg-red-500/20' : ''}
            ${card.priority === 'Medium' ? 'bg-amber-500/20' : ''}
            ${card.priority === 'Low' ? 'bg-blue-500/20' : ''}
          `}>
            <SourceIcon className={`w-5 h-5 ${sourceColor}`} />
          </div>

          {/* Priority Badge */}
          <span className={`
            px-2.5 py-1 rounded-full text-xs font-medium
            ${priority.bgColor} ${priority.color}
            border ${priority.borderColor}
          `}>
            {priority.icon} {priority.label}
          </span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeAgo(card.created_at)}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-white mb-2 leading-tight" dir="rtl">
        {card.title}
      </h3>

      {/* Description */}
      <p className="text-gray-300 text-sm leading-relaxed mb-4" dir="rtl">
        {card.description}
      </p>

      {/* Source Tag */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`
          flex items-center gap-1.5
          px-3 py-1.5
          rounded-lg
          bg-gray-700/50
          text-xs text-gray-400
        `}>
          <SourceIcon className={`w-3.5 h-3.5 ${sourceColor}`} />
          <span>{card.source}</span>
        </div>

        {card.category && (
          <div className="px-3 py-1.5 rounded-lg bg-gray-700/50 text-xs text-gray-400">
            {card.category}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-700/50">
        <button
          onClick={() => onExplainMore(card)}
          className="
            flex-1 flex items-center justify-center gap-2
            py-2.5 px-4
            bg-gradient-to-r from-purple-500/20 to-indigo-500/20
            hover:from-purple-500/30 hover:to-indigo-500/30
            border border-purple-500/30
            rounded-xl
            text-purple-300 text-sm font-medium
            transition-all duration-200
            hover:shadow-lg hover:shadow-purple-500/10
          "
        >
          <MessageCircle className="w-4 h-4" />
          הסבר לי עוד
        </button>

        <button
          onClick={() => onMarkDone(card.id)}
          disabled={isProcessing}
          className="
            flex-1 flex items-center justify-center gap-2
            py-2.5 px-4
            bg-gradient-to-r from-emerald-500/20 to-teal-500/20
            hover:from-emerald-500/30 hover:to-teal-500/30
            border border-emerald-500/30
            rounded-xl
            text-emerald-300 text-sm font-medium
            transition-all duration-200
            hover:shadow-lg hover:shadow-emerald-500/10
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          סומן כבוצע
        </button>
      </div>
    </div>
  );
}

// Completed Card (minimized view)
function CompletedCardItem({ card }: { card: OpportunityCard }) {
  return (
    <div className="
      flex items-center gap-3
      p-3
      bg-gray-800/50
      border border-gray-700/30
      rounded-xl
      opacity-70
    ">
      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      <span className="text-sm text-gray-400 flex-1 truncate" dir="rtl">
        {card.title}
      </span>
      <span className="text-xs text-gray-500">בוצע</span>
    </div>
  );
}

// Main Strategy Feed Component
export default function StrategyFeed() {
  const { user } = useAuth();
  const [cards, setCards] = useState<OpportunityCard[]>([]);
  const [completedCards, setCompletedCards] = useState<OpportunityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchFeed = async (refresh = false) => {
    if (!user?.id) return;

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = `http://localhost:8015/business/feed/${user.id}${refresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch strategy feed');
      }

      const data: FeedResponse = await response.json();

      // Separate active and completed cards
      const active = data.cards.filter(c => !c.is_actioned && !c.is_dismissed);
      const completed = data.cards.filter(c => c.is_actioned);

      setCards(active);
      setCompletedCards(completed);
      setCached(data.cached);

    } catch (err) {
      console.error('Strategy feed error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [user?.id]);

  const handleExplainMore = (card: OpportunityCard) => {
    // Dispatch custom event to open AI chat with this specific insight
    const message = `Explain this opportunity in more detail: "${card.title}". ${card.description}`;

    const event = new CustomEvent('openAiChat', {
      detail: { message, autoSend: true }
    });
    window.dispatchEvent(event);
  };

  const handleMarkDone = async (cardId: string) => {
    setProcessingCardId(cardId);

    try {
      const response = await fetch(`http://localhost:8015/business/feed/card/${cardId}?actioned=true`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark card as done');
      }

      // Move card to completed
      const card = cards.find(c => c.id === cardId);
      if (card) {
        setCards(prev => prev.filter(c => c.id !== cardId));
        setCompletedCards(prev => [{ ...card, is_actioned: true }, ...prev]);
      }

    } catch (err) {
      console.error('Error marking card as done:', err);
    } finally {
      setProcessingCardId(null);
    }
  };

  // Filter cards by priority
  const filteredCards = filterPriority
    ? cards.filter(c => c.priority === filterPriority)
    : cards;

  // Loading State
  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" />
            <Sparkles className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-gray-400 animate-pulse" dir="rtl">מנתח מודיעין עסקי...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-red-500/30 p-8">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchFeed()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">פיד אסטרטגי</h2>
            <p className="text-sm text-gray-400">
              {cards.length} הזדמנויות {cached && '(מהזיכרון)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority Filter */}
          <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setFilterPriority(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !filterPriority ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              הכל
            </button>
            <button
              onClick={() => setFilterPriority('High')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterPriority === 'High' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              גבוהה
            </button>
            <button
              onClick={() => setFilterPriority('Medium')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterPriority === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-amber-400'
              }`}
            >
              בינונית
            </button>
            <button
              onClick={() => setFilterPriority('Low')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterPriority === 'Low' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-blue-400'
              }`}
            >
              נמוכה
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchFeed(true)}
            disabled={refreshing}
            className="
              p-2.5
              bg-gray-800/50 hover:bg-gray-700/50
              border border-gray-700/50
              rounded-lg
              text-gray-400 hover:text-white
              transition-colors
              disabled:opacity-50
            "
            title="רענן פיד"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {filteredCards.map((card) => (
            <OpportunityCardItem
              key={card.id}
              card={card}
              onExplainMore={handleExplainMore}
              onMarkDone={handleMarkDone}
              isProcessing={processingCardId === card.id}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/30 rounded-2xl border border-gray-700/30 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-2" dir="rtl">לא נמצאו הזדמנויות</p>
          <p className="text-sm text-gray-500 mb-4" dir="rtl">
            הרדאר סורק כעת את השוק, מידע יופיע כאן בקרוב...
          </p>
          <button
            onClick={() => fetchFeed(true)}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-colors"
          >
            צור תובנות
          </button>
        </div>
      )}

      {/* Completed Section */}
      {completedCards.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-3"
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">
              בוצעו ({completedCards.length})
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-90' : ''}`} />
          </button>

          {showCompleted && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              {completedCards.map((card) => (
                <CompletedCardItem key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
