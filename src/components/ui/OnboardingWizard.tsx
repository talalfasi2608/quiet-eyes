import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { loadGoogleMaps } from '../../lib/googleMaps';
import {
  Building2,
  MapPin,
  Globe,
  Users,
  DollarSign,
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  Brain,
  Search,
  AlertCircle,
  Eye,
  Zap,
  Bot,
  Radar,
  FileSearch,
  Network,
  CheckCircle2,
  ArrowRight,
  Crown,
  Briefcase
} from 'lucide-react';

const API_BASE = 'http://localhost:8015';

// Industry options with icons
const industries = [
  { id: 'restaurant', label: 'מסעדות וקפה', labelEn: 'Restaurant & Cafe', icon: '🍽️' },
  { id: 'beauty', label: 'יופי וטיפוח', labelEn: 'Beauty & Wellness', icon: '💅' },
  { id: 'fitness', label: 'כושר ובריאות', labelEn: 'Fitness & Health', icon: '💪' },
  { id: 'retail', label: 'קמעונאות', labelEn: 'Retail', icon: '🛍️' },
  { id: 'services', label: 'שירותים מקצועיים', labelEn: 'Professional Services', icon: '💼' },
  { id: 'tech', label: 'טכנולוגיה', labelEn: 'Technology', icon: '💻' },
  { id: 'construction', label: 'בנייה ושיפוצים', labelEn: 'Construction', icon: '🏗️' },
  { id: 'education', label: 'חינוך והדרכה', labelEn: 'Education', icon: '📚' },
  { id: 'pets', label: 'חיות מחמד', labelEn: 'Pets & Animals', icon: '🐾' },
  { id: 'automotive', label: 'רכב', labelEn: 'Automotive', icon: '🚗' },
  { id: 'realestate', label: 'נדל"ן', labelEn: 'Real Estate', icon: '🏠' },
  { id: 'other', label: 'אחר', labelEn: 'Other', icon: '🏢' },
];

// Target audience options
const audienceOptions = [
  { id: 'families', label: 'משפחות', labelEn: 'Families' },
  { id: 'young_professionals', label: 'צעירים ומקצוענים', labelEn: 'Young Professionals' },
  { id: 'luxury', label: 'מחפשי יוקרה', labelEn: 'Luxury Seekers' },
  { id: 'investors', label: 'משקיעים', labelEn: 'Investors' },
  { id: 'businesses', label: 'עסקים (B2B)', labelEn: 'Businesses (B2B)' },
  { id: 'seniors', label: 'מבוגרים', labelEn: 'Seniors' },
  { id: 'students', label: 'סטודנטים', labelEn: 'Students' },
  { id: 'general', label: 'קהל רחב', labelEn: 'General Public' },
];

// Price tier options
const priceTiers = [
  {
    id: 'budget',
    label: 'תקציבי',
    description: 'תמחור תחרותי, נפח גבוה',
    icon: DollarSign,
    color: 'text-emerald-400'
  },
  {
    id: 'standard',
    label: 'סטנדרטי',
    description: 'יחס איכות-מחיר מאוזן',
    icon: DollarSign,
    color: 'text-blue-400'
  },
  {
    id: 'premium',
    label: 'פרימיום',
    description: 'איכות גבוהה, תמחור פרימיום',
    icon: Crown,
    color: 'text-purple-400'
  },
];

// AI Analysis phases for cool animation
const analysisPhases = [
  { text: 'סוכן AI מאתחל...', icon: Bot, duration: 1500 },
  { text: 'סורק את האתר שלך...', icon: Globe, duration: 2000 },
  { text: 'מנתח תוכן עמודים...', icon: FileSearch, duration: 2500 },
  { text: 'בודק נתוני Google Maps...', icon: MapPin, duration: 2000 },
  { text: 'מזהה שירותים וייחוד...', icon: Target, duration: 2000 },
  { text: 'מעריך מיצוב שוק...', icon: Radar, duration: 1500 },
  { text: 'מייצר תובנות...', icon: Brain, duration: 2000 },
  { text: 'בונה את ה-DNA העסקי שלך...', icon: Network, duration: 1500 },
];

interface AnalysisResult {
  top_services: string[];
  unique_selling_point: string;
  price_positioning: string;
  marketing_weaknesses: string[];
  overall_score?: number;
}

interface WizardData {
  businessName: string;
  address: string;
  industry: string;
  customIndustry: string;
  websiteUrl: string;
  analysis: AnalysisResult | null;
  priceTier: string;
  targetAudience: string[];
  mainCompetitor: string;
}

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { refreshProfile } = useSimulation();
  const navigate = useNavigate();
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Form data
  const [data, setData] = useState<WizardData>({
    businessName: '',
    address: '',
    industry: '',
    customIndustry: '',
    websiteUrl: '',
    analysis: null,
    priceTier: 'standard',
    targetAudience: [],
    mainCompetitor: '',
  });

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (currentStep !== 1 || !addressInputRef.current) return;

    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !addressInputRef.current) return;

      const autocomplete = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          types: ['address'],
          componentRestrictions: { country: 'il' },
        }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          setData(prev => ({ ...prev, address: place.formatted_address || '' }));
        }
      });
    };

    loadGoogleMaps().then(initAutocomplete).catch(() => {});
  }, [currentStep]);

  // Analysis phase animation with variable durations
  useEffect(() => {
    if (!isAnalyzing) return;

    let timeoutId: NodeJS.Timeout;

    const advancePhase = () => {
      setAnalysisPhase(prev => {
        const nextPhase = prev + 1;
        if (nextPhase < analysisPhases.length) {
          timeoutId = setTimeout(advancePhase, analysisPhases[nextPhase].duration);
          return nextPhase;
        }
        return prev;
      });
    };

    timeoutId = setTimeout(advancePhase, analysisPhases[0].duration);

    return () => clearTimeout(timeoutId);
  }, [isAnalyzing]);

  // Handlers
  const handleInputChange = (field: keyof WizardData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const toggleAudience = (audienceId: string) => {
    setData(prev => ({
      ...prev,
      targetAudience: prev.targetAudience.includes(audienceId)
        ? prev.targetAudience.filter(a => a !== audienceId)
        : [...prev.targetAudience, audienceId]
    }));
  };

  // Resolve the ACTUAL industry string to send to the backend.
  // If "other" is selected, use the custom text. Otherwise, use the Hebrew label + business name for context.
  const getResolvedIndustry = (): string => {
    if (data.industry === 'other') {
      return data.customIndustry.trim();
    }
    const selected = industries.find(i => i.id === data.industry);
    if (!selected) return data.industry;
    // Combine the business name with the category for specificity.
    // e.g., business_name="מספרה לכלבים", category="יופי וטיפוח"
    // → "מספרה לכלבים (יופי וטיפוח)"
    // The backend AI will use the full string to understand the exact niche.
    return `${data.businessName} - ${selected.label}`;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!data.businessName.trim()) {
          setError('נא להזין את שם העסק');
          return false;
        }
        if (!data.address.trim()) {
          setError('נא להזין את כתובת העסק');
          return false;
        }
        if (!data.industry) {
          setError('נא לבחור תחום פעילות');
          return false;
        }
        if (data.industry === 'other' && !data.customIndustry.trim()) {
          setError('נא להזין את תחום הפעילות');
          return false;
        }
        return true;
      case 2:
        return true; // Website is optional
      case 3:
        return true;
      default:
        return true;
    }
  };

  const createBusinessRecord = async (): Promise<string | null> => {
    if (!user?.id) return null;

    const resolvedIndustry = getResolvedIndustry();
    console.log('[Onboarding] Creating business with industry:', resolvedIndustry);

    try {
      const response = await fetch(`${API_BASE}/onboard/wizard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          business_name: data.businessName,
          address: data.address,
          industry: resolvedIndustry,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.business_id;
      }
    } catch (err) {
      console.error('Failed to create business:', err);
    }
    return null;
  };

  const handleAnalyze = async () => {
    if (!data.websiteUrl.trim()) {
      setError('נא להזין כתובת אתר לניתוח');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisPhase(0);
    setAnalysisComplete(false);
    setError(null);

    try {
      // Create business record first if not exists
      let bizId = businessId;
      if (!bizId) {
        bizId = await createBusinessRecord();
        if (bizId) setBusinessId(bizId);
      }

      if (!bizId) {
        throw new Error('Failed to create business record');
      }

      // Ensure URL has protocol
      let url = data.websiteUrl.trim();
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      // Call analyze endpoint with address for geocoding
      const response = await fetch(`${API_BASE}/onboard/analyze-site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          business_id: bizId,
          provided_address: data.address,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData(prev => ({
          ...prev,
          websiteUrl: url,
          analysis: result.analysis,
          // Auto-set price tier based on analysis
          priceTier: mapPricePositioning(result.analysis?.price_positioning),
        }));
        setAnalysisComplete(true);
      } else {
        throw new Error('Analysis failed');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('ניתוח האתר נכשל. ניתן להמשיך ללא ניתוח.');
    } finally {
      // Let animation complete
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 1500);
    }
  };

  const mapPricePositioning = (positioning?: string): string => {
    if (!positioning) return 'standard';
    const lower = positioning.toLowerCase();
    if (lower.includes('budget') || lower.includes('low')) return 'budget';
    if (lower.includes('premium') || lower.includes('high') || lower.includes('luxury')) return 'premium';
    return 'standard';
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    const resolvedIndustry = getResolvedIndustry();

    // Final validation — never send empty industry or address
    if (!resolvedIndustry || !data.address.trim()) {
      setError('נא למלא את כל השדות הנדרשים');
      return;
    }

    console.log('[Onboarding] Submitting:', {
      business_name: data.businessName,
      address: data.address,
      industry: resolvedIndustry,
    });

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/onboard/wizard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          business_name: data.businessName,
          address: data.address,
          industry: resolvedIndustry,
          website_url: data.websiteUrl || null,
          target_audience: data.targetAudience.join(','),
          price_tier: data.priceTier,
          main_competitor: data.mainCompetitor || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save business');
      }

      await refreshProfile();
      navigate('/dashboard/focus');
    } catch (err) {
      console.error('Submit failed:', err);
      setError('השמירה נכשלה. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-12">
      {[
        { num: 1, label: 'זהות' },
        { num: 2, label: 'נוכחות דיגיטלית' },
        { num: 3, label: 'אסטרטגיה' },
      ].map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${
                step.num === currentStep
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                  : step.num < currentStep
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}
            >
              {step.num < currentStep ? (
                <Check className="w-6 h-6" />
              ) : (
                step.num
              )}
            </div>
            <span className={`mt-2 text-sm font-medium ${
              step.num === currentStep ? 'text-indigo-400' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
          </div>
          {index < 2 && (
            <div className={`w-24 h-0.5 mx-4 transition-colors duration-300 ${
              step.num < currentStep ? 'bg-emerald-500' : 'bg-gray-800'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: The Identity
  const renderStep1 = () => (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-xl shadow-indigo-500/20">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">ספר לנו על העסק שלך</h2>
        <p className="text-gray-400">בוא נתחיל עם הבסיס</p>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          שם העסק
        </label>
        <input
          type="text"
          value={data.businessName}
          onChange={(e) => handleInputChange('businessName', e.target.value)}
          placeholder="לדוגמה: מאפיית תל אביב"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          <MapPin className="w-4 h-4 inline ml-1 text-indigo-400" />
          כתובת העסק
        </label>
        <input
          ref={addressInputRef}
          type="text"
          value={data.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          placeholder="התחל להקליד כתובת..."
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
        <p className="text-xs text-gray-500">
          זה עוזר לנו למצוא מתחרים באזור שלך
        </p>
      </div>

      {/* Industry */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          <Briefcase className="w-4 h-4 inline ml-1 text-indigo-400" />
          תחום פעילות
        </label>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {industries.map((industry) => (
            <button
              key={industry.id}
              type="button"
              onClick={() => handleInputChange('industry', industry.id)}
              className={`p-4 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] ${
                data.industry === industry.id
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
              }`}
            >
              <span className="text-2xl block mb-1">{industry.icon}</span>
              <span className={`text-xs font-medium ${
                data.industry === industry.id ? 'text-indigo-300' : 'text-gray-400'
              }`}>
                {industry.label}
              </span>
            </button>
          ))}
        </div>

        {/* Custom industry input when "Other" is selected */}
        {data.industry === 'other' && (
          <div className="mt-4">
            <input
              type="text"
              value={data.customIndustry}
              onChange={(e) => handleInputChange('customIndustry', e.target.value)}
              placeholder="תאר את התחום שלך, לדוגמה: מספרה לכלבים, סטודיו ליוגה..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-indigo-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-indigo-400 mt-1">
              ככל שתהיה יותר ספציפי, המודיעין יהיה מדויק יותר
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Step 2: Digital Presence
  const renderStep2 = () => (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-4 shadow-xl shadow-blue-500/20">
          <Globe className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">נוכחות דיגיטלית</h2>
        <p className="text-gray-400">בוא נאפשר ל-AI שלנו לנתח את הטביעה הדיגיטלית שלך</p>
      </div>

      {/* Website URL Input */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">
          כתובת האתר
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="url"
              value={data.websiteUrl}
              onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
              placeholder="www.yourbusiness.com"
              className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              dir="ltr"
              disabled={isAnalyzing}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !data.websiteUrl.trim()}
            className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
              isAnalyzing
                ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>מנתח...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>נתח</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {analysisComplete && data.analysis && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
            <span className="font-semibold text-lg">הניתוח הושלם!</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Services */}
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <h4 className="text-sm font-medium text-gray-400 mb-2">שירותים מובילים</h4>
              <ul className="space-y-1">
                {data.analysis.top_services?.slice(0, 3).map((service, i) => (
                  <li key={i} className="text-white text-sm flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    {service}
                  </li>
                ))}
              </ul>
            </div>

            {/* USP */}
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <h4 className="text-sm font-medium text-gray-400 mb-2">הייחוד שלך</h4>
              <p className="text-white text-sm">{data.analysis.unique_selling_point}</p>
            </div>

            {/* Price Position */}
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <h4 className="text-sm font-medium text-gray-400 mb-2">מיצוב מחיר</h4>
              <p className="text-white text-sm font-medium">{data.analysis.price_positioning}</p>
            </div>

            {/* Weaknesses */}
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <h4 className="text-sm font-medium text-gray-400 mb-2">נקודות לשיפור</h4>
              <ul className="space-y-1">
                {data.analysis.marketing_weaknesses?.slice(0, 2).map((weakness, i) => (
                  <li key={i} className="text-amber-400 text-sm flex items-start gap-2">
                    <span>⚠️</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Skip option */}
      {!analysisComplete && !isAnalyzing && (
        <p className="text-center text-gray-500 text-sm">
          אין לך אתר? אין בעיה - אפשר לדלג על השלב הזה.
        </p>
      )}
    </div>
  );

  // Step 3: Strategy & Goals
  const renderStep3 = () => (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-xl shadow-purple-500/20">
          <Target className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">אסטרטגיה ויעדים</h2>
        <p className="text-gray-400">עזור לנו להבין את הנוף התחרותי שלך</p>
      </div>

      {/* Price Tier */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">
          רמת מחיר
        </label>
        <div className="grid grid-cols-3 gap-4">
          {priceTiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleInputChange('priceTier', tier.id)}
                className={`p-5 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] ${
                  data.priceTier === tier.id
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className={`flex justify-center mb-2 ${tier.color}`}>
                  {tier.id === 'budget' && <DollarSign className="w-6 h-6" />}
                  {tier.id === 'standard' && (
                    <div className="flex">
                      <DollarSign className="w-5 h-5" />
                      <DollarSign className="w-5 h-5 -ml-2" />
                    </div>
                  )}
                  {tier.id === 'premium' && (
                    <div className="flex">
                      <DollarSign className="w-5 h-5" />
                      <DollarSign className="w-5 h-5 -ml-2" />
                      <DollarSign className="w-5 h-5 -ml-2" />
                    </div>
                  )}
                </div>
                <span className={`font-semibold block ${
                  data.priceTier === tier.id ? 'text-white' : 'text-gray-300'
                }`}>
                  {tier.label}
                </span>
                <span className="text-xs text-gray-500 mt-1 block">
                  {tier.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Audience */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">
          <Users className="w-4 h-4 inline ml-1 text-indigo-400" />
          קהל יעד (בחר את כל המתאימים)
        </label>
        <div className="flex flex-wrap gap-2">
          {audienceOptions.map((audience) => (
            <button
              key={audience.id}
              type="button"
              onClick={() => toggleAudience(audience.id)}
              className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                data.targetAudience.includes(audience.id)
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {audience.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Competitor */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          <Target className="w-4 h-4 inline ml-1 text-red-400" />
          המתחרה המרכזי שלך
        </label>
        <input
          type="text"
          value={data.mainCompetitor}
          onChange={(e) => handleInputChange('mainCompetitor', e.target.value)}
          placeholder="הזן את שם המתחרה מספר 1 שלך"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
        />
        <p className="text-xs text-gray-500">
          נעקוב אחריהם אוטומטית ונתריע על כל מהלך שלהם
        </p>
      </div>

      {/* AI Insights from Analysis */}
      {data.analysis && (
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">המלצת AI</span>
          </div>
          <p className="text-gray-300 text-sm">
            לפי הניתוח שלנו, אתה ממוצב כ-<strong className="text-white">{data.analysis.price_positioning}</strong>.
            החוזקה המרכזית שלך: <strong className="text-white">{data.analysis.unique_selling_point}</strong>
          </p>
        </div>
      )}
    </div>
  );

  // AI Analysis Animation Overlay
  const renderAnalysisOverlay = () => {
    const CurrentIcon = analysisPhases[analysisPhase]?.icon || Bot;

    return (
      <div className="fixed inset-0 z-50 bg-gray-900/98 backdrop-blur-xl flex items-center justify-center">
        <div className="text-center space-y-8 max-w-lg px-8">
          {/* Animated Robot/AI */}
          <div className="relative w-40 h-40 mx-auto">
            {/* Outer rings */}
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-4 rounded-full border-2 border-indigo-500/30 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute inset-8 rounded-full border-2 border-indigo-500/40 animate-pulse" />

            {/* Scanning line */}
            <div
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(99, 102, 241, 0.4) 60deg, transparent 120deg)',
                animation: 'spin 2s linear infinite'
              }}
            />

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                <CurrentIcon className="w-12 h-12 text-white animate-pulse" />
              </div>
            </div>

            {/* Floating particles */}
            <div className="absolute top-2 right-6 w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="absolute top-10 left-2 w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
            <div className="absolute bottom-6 right-2 w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.6s' }} />
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">
              סוכן AI מנתח...
            </h2>

            <div className="h-12 flex items-center justify-center">
              <p className="text-indigo-400 text-lg font-medium animate-pulse">
                {analysisPhases[analysisPhase]?.text || 'מעבד...'}
              </p>
            </div>

            <p className="text-gray-500 text-sm">
              סורק את האתר ובודק נתוני Google Maps
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-full transition-all duration-500"
              style={{ width: `${((analysisPhase + 1) / analysisPhases.length) * 100}%` }}
            />
          </div>

          {/* Phase indicators */}
          <div className="flex justify-center gap-2">
            {analysisPhases.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i <= analysisPhase ? 'bg-indigo-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {/* Analysis Overlay */}
      {isAnalyzing && renderAnalysisOverlay()}

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Quiet Eyes</h1>
            </div>
            <p className="text-gray-400">מודיעין עסקי מונע AI</p>
          </div>

          {/* Wizard Card */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            {/* Step Content */}
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-700/50">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                  currentStep === 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
                <span>חזרה</span>
              </button>

              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>שומר...</span>
                  </>
                ) : currentStep === 3 ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>לדשבורד</span>
                  </>
                ) : (
                  <>
                    <span>המשך</span>
                    <ChevronLeft className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex justify-center gap-8 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>מונע AI</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>מעקב מתחרים</span>
            </div>
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-indigo-400" />
              <span>מודיעין בזמן אמת</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Type declarations
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: google.maps.places.AutocompleteOptions
          ) => google.maps.places.Autocomplete;
        };
      };
    };
  }
}
