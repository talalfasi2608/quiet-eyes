import { useSimulation } from '../../context/SimulationContext';
import { Calendar, TrendingUp, Zap, Loader2, CalendarX, Sparkles } from 'lucide-react';

export default function Horizon() {
  const { currentProfile } = useSimulation();

  // Loading state
  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-gray-400">טוען תחזיות...</p>
      </div>
    );
  }

  const { trendingTopics, nameHebrew, emoji } = currentProfile;

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getImpactLabel = (impact: string) => {
    switch (impact) {
      case 'high': return 'השפעה גבוהה';
      case 'medium': return 'השפעה בינונית';
      default: return 'השפעה נמוכה';
    }
  };

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">האופק</h1>
        <p className="text-gray-400">מגמות, אירועים והזדמנויות עתידיות עבור {nameHebrew} {emoji}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Widget - Empty State */}
        <div className="lg:col-span-2">
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">אירועים קרובים</h2>
                <p className="text-gray-400 text-sm">הזדמנויות להכנה מראש</p>
              </div>
            </div>

            {/* Empty state for events - will be populated when API is connected */}
            <div className="text-center py-12">
              <CalendarX className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">אין אירועים מתוכננים כרגע</p>
              <p className="text-gray-500 text-sm mt-2">אירועים יופיעו כאן כשנזהה הזדמנויות עסקיות</p>
            </div>
          </div>
        </div>

        {/* Weather Impact - Simplified empty state */}
        <div className="lg:col-span-1">
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">תובנות עסקיות</h2>
                <p className="text-gray-400 text-sm">המלצות מותאמות אישית</p>
              </div>
            </div>

            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">אין תובנות חדשות כרגע</p>
              <p className="text-gray-500 text-xs mt-1">סרוק מתחרים לקבלת תובנות</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trends Section - Uses trendingTopics from context */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">מגמות בתעשייה</h2>
            <p className="text-gray-400 text-sm">טרנדים שזוהו בניתוח AI</p>
          </div>
        </div>

        {!trendingTopics || trendingTopics.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">לא זוהו מגמות עדיין</p>
            <p className="text-gray-500 text-sm mt-2">מגמות יופיעו לאחר ניתוח העסק והמתחרים</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {trendingTopics.map((topic, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold">{topic}</h3>
                    <span className={"px-2 py-1 rounded-full text-xs border " + getImpactColor(index === 0 ? 'high' : index === 1 ? 'medium' : 'low')}>
                      {getImpactLabel(index === 0 ? 'high' : index === 1 ? 'medium' : 'low')}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">מגמה שזוהתה בתעשייה שלך</p>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">המלצה חכמה</h3>
                  <p className="text-gray-300 text-sm">
                    {trendingTopics.length > 0
                      ? `מגמת "${trendingTopics[0]}" מזוהה כרלוונטית לעסק שלך. שקול לשלב אותה באסטרטגיה השיווקית.`
                      : 'סרוק את השוק שלך לקבלת המלצות מותאמות אישית.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
