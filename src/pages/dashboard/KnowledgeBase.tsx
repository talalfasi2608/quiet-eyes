import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Brain,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  BookOpen,
  Target,
  Lightbulb,
  Save,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Zap,
  Eye,
  Link as LinkIcon,
  FileText,
  ChevronRight,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';
import PageLoader from '../../components/ui/PageLoader';

// Types
interface TrackedSite {
  id: string;
  url: string;
  name: string;
  type: 'auto' | 'custom';
  status: 'active' | 'pending' | 'error';
  lastScanned?: string;
  insights?: number;
}

interface LearningProgress {
  overall: number;
  categories: {
    name: string;
    nameHebrew: string;
    progress: number;
    icon: string;
  }[];
  dataPoints: number;
  lastUpdated: string;
}

interface KnowledgeData {
  uniqueStyle: string;
  secretSauce: string;
  targetNiche: string;
  competitiveEdge: string;
}

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Knowledge data state
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeData>({
    uniqueStyle: '',
    secretSauce: '',
    targetNiche: '',
    competitiveEdge: ''
  });

  // Tracked sites state
  const [trackedSites, setTrackedSites] = useState<TrackedSite[]>([]);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [addingSite, setAddingSite] = useState(false);

  // Learning progress state
  const [learningProgress, setLearningProgress] = useState<LearningProgress>({
    overall: 0,
    categories: [],
    dataPoints: 0,
    lastUpdated: ''
  });

  // Safety timeout: never spin forever
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (user?.id) {
      fetchKnowledgeData();
    }
  }, [user?.id]);

  const fetchKnowledgeData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/knowledge/${user.id}`);

      if (response.ok) {
        const data = await response.json();

        if (data.knowledge) {
          setKnowledgeData(data.knowledge);
        }
        if (data.tracked_sites) {
          setTrackedSites(data.tracked_sites);
        }
        if (data.learning_progress) {
          setLearningProgress({
            ...data.learning_progress,
            categories: Array.isArray(data.learning_progress.categories) ? data.learning_progress.categories : [],
          });
        }
      } else if (response.status === 404) {
        // No data yet, use defaults
        generateDefaultSites();
      }
    } catch (err) {
      toast.error('שגיאה בטעינת נתונים');
      generateDefaultSites();
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultSites = () => {
    // Generate some default tracked sites based on industry
    const defaultSites: TrackedSite[] = [
      {
        id: '1',
        url: 'https://www.google.com/maps',
        name: 'Google Maps Reviews',
        type: 'auto',
        status: 'active',
        lastScanned: new Date().toISOString(),
        insights: 12
      },
      {
        id: '2',
        url: 'https://www.facebook.com',
        name: 'Facebook Business',
        type: 'auto',
        status: 'active',
        lastScanned: new Date().toISOString(),
        insights: 8
      },
      {
        id: '3',
        url: 'https://www.instagram.com',
        name: 'Instagram Profile',
        type: 'auto',
        status: 'pending',
        insights: 0
      }
    ];
    setTrackedSites(defaultSites);

    // Default learning progress
    setLearningProgress({
      overall: 35,
      categories: [
        { name: 'Business Profile', nameHebrew: 'פרופיל עסקי', progress: 60, icon: '🏢' },
        { name: 'Market Position', nameHebrew: 'מיקום שוק', progress: 45, icon: '📊' },
        { name: 'Competitor Intel', nameHebrew: 'מודיעין מתחרים', progress: 30, icon: '🎯' },
        { name: 'Customer Insights', nameHebrew: 'תובנות לקוחות', progress: 20, icon: '👥' },
        { name: 'Industry Trends', nameHebrew: 'מגמות תעשייה', progress: 25, icon: '📈' }
      ],
      dataPoints: 47,
      lastUpdated: new Date().toISOString()
    });
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    try {
      const response = await apiFetch(`/knowledge/${user.id}`, {
        method: 'POST',
        body: JSON.stringify({
          knowledge: knowledgeData,
          tracked_sites: trackedSites.filter(s => s.type === 'custom')
        })
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      toast.error('שגיאה בשמירה');
      setError('שמירת השינויים נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSite = async () => {
    if (!newSiteUrl.trim()) return;
    setAddingSite(true);

    try {
      // Validate and format URL
      let url = newSiteUrl.trim();
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      const newSite: TrackedSite = {
        id: Date.now().toString(),
        url,
        name: new URL(url).hostname.replace('www.', ''),
        type: 'custom',
        status: 'pending',
        insights: 0
      };

      setTrackedSites([...trackedSites, newSite]);
      setNewSiteUrl('');

      // Trigger discovery for this site
      if (user?.id) {
        await apiFetch(`/knowledge/discover-site`, {
          method: 'POST',
          body: JSON.stringify({
            user_id: user.id,
            url
          })
        });
      }
    } catch (err) {
      setError('פורמט כתובת לא תקין');
    } finally {
      setAddingSite(false);
    }
  };

  const handleRemoveSite = (siteId: string) => {
    setTrackedSites(trackedSites.filter(s => s.id !== siteId));
  };

  const triggerLearning = async () => {
    if (!user?.id) return;

    try {
      const response = await apiFetch(`/knowledge/learn/${user.id}`, {
        method: 'POST'
      });

      if (response.ok) {
        // Refresh progress
        fetchKnowledgeData();
      }
    } catch (err) {
      // silently ignore
    }
  };

  // Loading state
  if (loading) {
    return (
      <PageLoader message="טוען בסיס ידע..." />
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Brain className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">בסיס ידע</h1>
            <p className="text-gray-400">למד את ה-AI על הנישה הייחודית של העסק שלך</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`btn-primary flex items-center gap-2 ${saved ? 'bg-emerald-500' : ''}`}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>שומר...</span>
            </>
          ) : saved ? (
            <>
              <Check className="w-5 h-5" />
              <span>נשמר!</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>שמור שינויים</span>
            </>
          )}
        </button>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ms-auto text-red-400 hover:text-red-300">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Tell Me More */}
        <div className="lg:col-span-2 space-y-6">
          {/* Unique Style & Methods */}
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">ספר לי עוד</h2>
                <p className="text-sm text-gray-500">תאר את הסגנון והשיטות הייחודיים שלך</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Unique Style */}
              <div>
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium mb-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  מה מייחד את העסק שלך?
                </label>
                <textarea
                  value={knowledgeData.uniqueStyle}
                  onChange={(e) => setKnowledgeData({ ...knowledgeData, uniqueStyle: e.target.value })}
                  placeholder="לדוגמה: אנחנו משתמשים רק בחומרים אורגניים מקומיים ויש לנו מתכון סודי שעובר במשפחה כבר 3 דורות..."
                  className="w-full h-32 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ככל שתספק יותר פרטים, כך התובנות יהיו טובות יותר
                </p>
              </div>

              {/* Secret Sauce */}
              <div>
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium mb-2">
                  <Lightbulb className="w-4 h-4 text-indigo-400" />
                  הנשק הסודי שלך
                </label>
                <textarea
                  value={knowledgeData.secretSauce}
                  onChange={(e) => setKnowledgeData({ ...knowledgeData, secretSauce: e.target.value })}
                  placeholder="מה היתרון התחרותי שלך? טכניקות מיוחדות, שותפויות בלעדיות, חוויית לקוח ייחודית..."
                  className="w-full h-28 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
                />
              </div>

              {/* Target Niche */}
              <div>
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium mb-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  נישת יעד
                </label>
                <textarea
                  value={knowledgeData.targetNiche}
                  onChange={(e) => setKnowledgeData({ ...knowledgeData, targetNiche: e.target.value })}
                  placeholder="תאר את הלקוח האידיאלי שלך ואת פלח השוק הספציפי שאתה משרת..."
                  className="w-full h-24 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
                />
              </div>

              {/* Competitive Edge */}
              <div>
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium mb-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  יתרון תחרותי
                </label>
                <textarea
                  value={knowledgeData.competitiveEdge}
                  onChange={(e) => setKnowledgeData({ ...knowledgeData, competitiveEdge: e.target.value })}
                  placeholder="למה לקוחות בוחרים בך ולא במתחרים? מה אתה עושה טוב יותר מכולם?"
                  className="w-full h-24 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Tracked Sites */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">אתרים במעקב</h2>
                  <p className="text-sm text-gray-500">מקורות מידע שזוהו ע״י AI ומותאמים אישית</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm">
                {trackedSites.length} אתרים
              </span>
            </div>

            {/* Site List */}
            <div className="space-y-3 mb-4">
              {trackedSites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 border border-gray-700/30 hover:border-gray-600/50 transition-all group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      site.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : site.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {site.status === 'active' ? (
                        <Eye className="w-5 h-5" />
                      ) : site.status === 'pending' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium truncate">{site.name}</p>
                        {site.type === 'auto' && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs">
                            זוהה ע״י AI
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm truncate">{site.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {site.insights !== undefined && site.insights > 0 && (
                      <span className="text-sm text-gray-400">
                        {site.insights} תובנות
                      </span>
                    )}
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {site.type === 'custom' && (
                      <button
                        onClick={() => handleRemoveSite(site.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom URL */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="url"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  placeholder="הוסף כתובת אתר למעקב..."
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                />
              </div>
              <button
                onClick={handleAddSite}
                disabled={addingSite || !newSiteUrl.trim()}
                className="px-5 py-3 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {addingSite ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                <span>הוסף</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Learning Progress */}
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">התקדמות למידה</h2>
              </div>
              <button
                onClick={triggerLearning}
                className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                title="הפעל למידה"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Progress Circle */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-36 h-36">
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-700"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke="url(#progressGradient)"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${learningProgress.overall * 4.02} 402`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00d4ff" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-white">{learningProgress.overall}%</span>
                  <span className="text-sm text-gray-400">נלמד</span>
                </div>
              </div>
              <p className="text-center text-gray-400 text-sm mt-4">
                {learningProgress.dataPoints} נקודות מידע נותחו
              </p>
            </div>

            {/* Category Progress */}
            <div className="space-y-4">
              {(Array.isArray(learningProgress.categories) ? learningProgress.categories : []).map((category, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span className="text-gray-300 text-sm">{category.nameHebrew}</span>
                    </div>
                    <span className="text-gray-400 text-sm">{category.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-700/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${category.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Last Updated */}
            {learningProgress.lastUpdated && (
              <p className="text-center text-gray-500 text-xs mt-4">
                עדכון אחרון: {new Date(learningProgress.lastUpdated).toLocaleDateString('he-IL')}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              פעולות מהירות
            </h3>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/domain/insight/${user?.id}`);
                    const data = await res.json();
                    if (data.insight) {
                      toast.success('תובנה נוצרה בהצלחה');
                    } else {
                      toast('אין תובנות זמינות כרגע');
                    }
                  } catch {
                    toast.error('שגיאה ביצירת תובנה');
                  }
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 hover:border-indigo-500/30 text-gray-300 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-cyan-400" />
                  <span>צור תובנה ראשית</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors" />
              </button>

              <button
                onClick={triggerLearning}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 hover:border-emerald-500/30 text-gray-300 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  <span>רענן נתוני למידה</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 transition-colors" />
              </button>

              <button
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 hover:border-cyan-500/30 text-gray-300 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <span>ייצא דוח ידע</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
              </button>
            </div>
          </div>

          {/* Tips Card */}
          <div className="glass-card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">טיפים מקצועיים</h3>
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    הוסף אתרי מתחרים כדי לעקוב אחר שינויים שלהם
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    ככל שתתאר יותר את העסק, כך התובנות ישתפרו
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    עדכן את הנשק הסודי שלך באופן קבוע ככל שאתה מתפתח
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
