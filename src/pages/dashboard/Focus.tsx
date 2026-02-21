import { useState } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import ActionCard from '../../components/ui/ActionCard';
import ActionModal from '../../components/ui/ActionModal';
import StrategicRoadmap from '../../components/ui/StrategicRoadmap';
import StrategyFeed from '../../components/ui/StrategyFeed';
import IntelligenceHistory from '../../components/ui/IntelligenceHistory';
import { Zap, UserPlus, FileText, RefreshCw, Loader2 } from 'lucide-react';

const quickActions = [
  { icon: RefreshCw, label: 'סריקה עכשיו', color: 'from-indigo-500 to-purple-500' },
  { icon: UserPlus, label: 'הוסף מתחרה', color: 'from-emerald-500 to-teal-500' },
  { icon: FileText, label: 'צפה בדוחות', color: 'from-amber-500 to-orange-500' },
];

export default function Focus() {
  const { currentProfile } = useSimulation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  // Loading state
  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-gray-400">טוען מודיעין אמיתי...</p>
      </div>
    );
  }

  const { cards, pulseScore, pulseChange, weeklyStats, nameHebrew, emoji, trendingTopics } = currentProfile;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  const handleCardAction = (title: string) => {
    setSelectedAction(title);
    setModalOpen(true);
  };

  const getPulseColor = () => {
    if (pulseScore >= 8) return 'from-emerald-400 to-green-400';
    if (pulseScore >= 6) return 'from-indigo-400 to-purple-400';
    return 'from-amber-400 to-orange-400';
  };

  return (
    <div className="space-y-6 fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {getGreeting()}, {nameHebrew}
        </h1>
        <p className="text-gray-400">
          הנה מה שקורה היום בשוק שלך {emoji}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pulse Score */}
        <div className="lg:col-span-3">
          <div className="glass-card text-center sticky top-6">
            <div className="mb-4">
              <span className="text-sm text-gray-400 block mb-2">בריאות העסק</span>
              <div className="relative inline-flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center glow-pulse">
                  <div className="w-28 h-28 rounded-full bg-gray-900 flex items-center justify-center">
                    <span className={"text-5xl font-bold bg-gradient-to-r bg-clip-text text-transparent " + getPulseColor()}>
                      {pulseScore}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={"flex items-center justify-center gap-2 " + (pulseChange.startsWith('+') ? "text-emerald-400" : "text-red-400")}>
              <Zap className="w-4 h-4" />
              <span className="text-sm">{pulseChange} מאתמול</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">מבוסס על נתונים אמיתיים</p>
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-sm">
                {emoji} {nameHebrew}
              </span>
            </div>
          </div>
        </div>

        {/* Cards Feed */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">הפיד שלך</h2>
            <span className="text-sm text-gray-400">{cards.length} עדכונים</span>
          </div>

          {cards.length === 0 ? (
            <div className="glass-card text-center py-12">
              <p className="text-gray-400">אין התראות או הזדמנויות כרגע</p>
              <p className="text-gray-500 text-sm mt-2">הכל נראה טוב!</p>
            </div>
          ) : (
            cards.map((card) => (
              <ActionCard
                key={card.id}
                type={card.type}
                title={card.title}
                description={card.description}
                actionButtonText={card.actionButtonText}
                onAction={() => handleCardAction(card.title)}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">פעולות מהירות</h2>
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="w-full glass-card glass-hover p-4 flex items-center gap-4 text-right"
            >
              <div className={"w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center " + action.color}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <span className="font-medium text-white">{action.label}</span>
            </button>
          ))}

          {/* Weekly Stats */}
          <div className="glass-card p-4 mt-6">
            <h3 className="text-sm text-gray-400 mb-3">סיכום שבועי</h3>
            {weeklyStats.length === 0 ? (
              <p className="text-gray-500 text-sm">אין נתונים עדיין</p>
            ) : (
              <div className="space-y-3">
                {weeklyStats.map((stat) => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">{stat.label}</span>
                    <span className="text-white font-medium">{stat.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trending Topics */}
          {trendingTopics && trendingTopics.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm text-gray-400 mb-3">טרנדים בתעשייה</h3>
              <div className="flex flex-wrap gap-2">
                {trendingTopics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strategic Roadmap - Full Width Section */}
      <div className="mt-8">
        <StrategicRoadmap />
      </div>

      {/* Strategy Intelligence Feed - Full Width Section */}
      <div className="mt-8">
        <StrategyFeed />
      </div>

      {/* Intelligence History - Full Width Section */}
      <div className="mt-8">
        <IntelligenceHistory />
      </div>

      <ActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => {
          console.log('Action confirmed:', selectedAction);
          setModalOpen(false);
        }}
        title="אישור פעולה"
        description={"האם אתה בטוח שברצונך להמשיך עם: " + (selectedAction || '')}
      />
    </div>
  );
}
