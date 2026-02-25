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
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  Eye,
  Zap,
  Target,
  Radar,
  Phone,
  Clock,
  Briefcase,
  Settings,
  MessageCircle,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

// ── Option arrays ────────────────────────────────────────────────────────────

const industries = [
  { id: 'restaurant', label: 'מסעדה/בית קפה', icon: '🍽️' },
  { id: 'beauty', label: 'יופי וטיפוח', icon: '💅' },
  { id: 'fitness', label: 'כושר ובריאות', icon: '💪' },
  { id: 'realestate', label: 'נדל"ן', icon: '🏠' },
  { id: 'ecommerce', label: 'איקומרס', icon: '🛒' },
  { id: 'agency', label: 'סוכנות שיווק', icon: '📢' },
  { id: 'other', label: 'אחר', icon: '🏢' },
];

const businessAgeOptions = [
  { id: 'less_than_1', label: 'פחות משנה' },
  { id: '1_to_3', label: '1-3 שנים' },
  { id: '3_plus', label: '3+ שנים' },
];

const employeeCountOptions = [
  { id: 'solo', label: 'רק אני' },
  { id: '2_5', label: '2-5' },
  { id: '6_20', label: '6-20' },
  { id: '20_plus', label: '20+' },
];

const avgPriceOptions = [
  { id: 'up_to_100', label: 'עד 100₪' },
  { id: '100_500', label: '100-500₪' },
  { id: '500_2000', label: '500-2000₪' },
  { id: '2000_plus', label: '2000+₪' },
];

const idealCustomerOptions = [
  { id: 'families', label: 'משפחות' },
  { id: 'young_couples', label: 'זוגות צעירים' },
  { id: 'students', label: 'סטודנטים' },
  { id: 'business_people', label: 'אנשי עסקים' },
  { id: 'seniors', label: 'קשישים' },
  { id: 'tourists', label: 'תיירים' },
];

const discoveryChannelOptions = [
  { id: 'google', label: 'גוגל' },
  { id: 'facebook', label: 'פייסבוק' },
  { id: 'recommendations', label: 'המלצות' },
  { id: 'instagram', label: 'אינסטגרם' },
  { id: 'word_of_mouth', label: 'מפה לאוזן' },
  { id: 'sign', label: 'שלט' },
];

const challengeOptions = [
  { id: 'find_customers', label: 'למצוא לקוחות' },
  { id: 'retain_customers', label: 'לשמר לקוחות' },
  { id: 'compete', label: 'להתמודד עם מתחרים' },
  { id: 'manage_time', label: 'לנהל זמן' },
  { id: 'improve_reviews', label: 'לשפר ביקורות' },
];

const dailyUpdateTimeOptions = [
  { id: 'morning', label: 'בוקר 8:00' },
  { id: 'noon', label: 'צהריים 12:00' },
  { id: 'evening', label: 'ערב 18:00' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  businessName: string;
  businessType: string;
  customIndustry: string;
  city: string;
  exactAddress: string;
  phone: string;
  websiteUrl: string;
  latitude: number | null;
  longitude: number | null;
  businessAge: string;
  employeeCount: string;
  mainProduct: string;
  avgTransactionPrice: string;
  idealCustomers: string[];
  discoveryChannels: string[];
  mainChallenge: string;
  competitors: string[];
  whatsappNumber: string;
  dailyUpdateTime: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { refreshProfile } = useSimulation();
  const navigate = useNavigate();
  const cityInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<WizardData>({
    businessName: '',
    businessType: '',
    customIndustry: '',
    city: '',
    exactAddress: '',
    phone: '',
    websiteUrl: '',
    latitude: null,
    longitude: null,
    businessAge: '',
    employeeCount: '',
    mainProduct: '',
    avgTransactionPrice: '',
    idealCustomers: [],
    discoveryChannels: [],
    mainChallenge: '',
    competitors: ['', '', ''],
    whatsappNumber: '',
    dailyUpdateTime: 'morning',
  });

  // Google Places autocomplete for city
  useEffect(() => {
    if (currentStep !== 1 || !cityInputRef.current) return;

    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !cityInputRef.current) return;

      const autocomplete = new window.google.maps.places.Autocomplete(
        cityInputRef.current,
        {
          types: ['(cities)'],
          componentRestrictions: { country: 'il' },
        }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const cityName = place.formatted_address || place.name || '';
        const lat = place.geometry?.location?.lat() ?? null;
        const lng = place.geometry?.location?.lng() ?? null;
        setData(prev => ({ ...prev, city: cityName, latitude: lat, longitude: lng }));
      });
    };

    loadGoogleMaps().then(initAutocomplete).catch(() => {});
  }, [currentStep]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleInputChange = (field: keyof WizardData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const toggleMultiSelect = (field: 'idealCustomers' | 'discoveryChannels', id: string) => {
    setData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).includes(id)
        ? (prev[field] as string[]).filter(item => item !== id)
        : [...(prev[field] as string[]), id],
    }));
  };

  const updateCompetitor = (index: number, value: string) => {
    setData(prev => {
      const updated = [...prev.competitors];
      updated[index] = value;
      return { ...prev, competitors: updated };
    });
  };

  const getResolvedIndustry = (): string => {
    if (data.businessType === 'other') {
      return data.customIndustry.trim();
    }
    const selected = industries.find(i => i.id === data.businessType);
    return selected ? selected.label : data.businessType;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!data.businessName.trim()) { setError('נא להזין את שם העסק'); return false; }
        if (!data.businessType) { setError('נא לבחור סוג עסק'); return false; }
        if (data.businessType === 'other' && !data.customIndustry.trim()) { setError('נא להזין את תחום הפעילות'); return false; }
        if (!data.city.trim()) { setError('נא להזין עיר'); return false; }
        return true;
      default:
        return true; // Steps 2-4 are all optional
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    const resolvedIndustry = getResolvedIndustry();
    if (!resolvedIndustry || !data.city.trim()) {
      setError('נא למלא את כל השדות הנדרשים');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const competitorsList = data.competitors.filter(c => c.trim()).join(', ');

      const response = await apiFetch(`/onboard/wizard`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          business_name: data.businessName,
          address: data.city,
          industry: resolvedIndustry,
          website_url: data.websiteUrl || null,
          exact_address: data.exactAddress || null,
          phone: data.phone || null,
          business_age: data.businessAge || null,
          employee_count: data.employeeCount || null,
          main_product: data.mainProduct || null,
          avg_transaction_price: data.avgTransactionPrice || null,
          ideal_customers: data.idealCustomers.length ? data.idealCustomers.join(',') : null,
          discovery_channels: data.discoveryChannels.length ? data.discoveryChannels.join(',') : null,
          main_challenge: data.mainChallenge || null,
          competitors_list: competitorsList || null,
          whatsapp_number: data.whatsappNumber || null,
          daily_update_time: data.dailyUpdateTime || null,
          latitude: data.latitude,
          longitude: data.longitude,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save business');
      }

      const result = await response.json();
      localStorage.setItem('qe_business_id', result.business_id);
      localStorage.setItem('qe_onboarding_done', 'true');

      await refreshProfile();
      navigate('/dashboard/focus');
    } catch (err) {
      setError('השמירה נכשלה. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step indicator ───────────────────────────────────────────────────────

  const steps = [
    { num: 1, label: 'פרטי עסק' },
    { num: 2, label: 'על העסק' },
    { num: 3, label: 'הלקוחות' },
    { num: 4, label: 'הגדרות' },
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-12">
      {steps.map((step, index) => (
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
              {step.num < currentStep ? <Check className="w-6 h-6" /> : step.num}
            </div>
            <span className={`mt-2 text-sm font-medium ${
              step.num === currentStep ? 'text-indigo-400' : 'text-gray-500'
            }`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 sm:w-24 h-0.5 mx-2 sm:mx-4 transition-colors duration-300 ${
              step.num < currentStep ? 'bg-emerald-500' : 'bg-gray-800'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Step 1: Business basics ──────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 mb-4 shadow-xl shadow-blue-500/20">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">פרטי העסק</h2>
        <p className="text-gray-400">בוא נתחיל עם הבסיס</p>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">שם העסק *</label>
        <input
          type="text"
          value={data.businessName}
          onChange={(e) => handleInputChange('businessName', e.target.value)}
          placeholder="לדוגמה: מאפיית תל אביב"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Business Type */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          <Briefcase className="w-4 h-4 inline ml-1 text-indigo-400" />
          סוג עסק *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {industries.map((industry) => (
            <button
              key={industry.id}
              type="button"
              onClick={() => handleInputChange('businessType', industry.id)}
              className={`p-3 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] ${
                data.businessType === industry.id
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
              }`}
            >
              <span className="text-2xl block mb-1">{industry.icon}</span>
              <span className={`text-xs font-medium ${
                data.businessType === industry.id ? 'text-indigo-300' : 'text-gray-400'
              }`}>
                {industry.label}
              </span>
            </button>
          ))}
        </div>
        {data.businessType === 'other' && (
          <input
            type="text"
            value={data.customIndustry}
            onChange={(e) => handleInputChange('customIndustry', e.target.value)}
            placeholder="תאר את התחום שלך..."
            className="w-full px-4 py-3 bg-gray-800/50 border border-indigo-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        )}
      </div>

      {/* City */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          <MapPin className="w-4 h-4 inline ml-1 text-indigo-400" />
          עיר *
        </label>
        <input
          ref={cityInputRef}
          type="text"
          value={data.city}
          onChange={(e) => handleInputChange('city', e.target.value)}
          placeholder="התחל להקליד שם עיר..."
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Exact Address */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">כתובת מדויקת</label>
        <input
          type="text"
          value={data.exactAddress}
          onChange={(e) => handleInputChange('exactAddress', e.target.value)}
          placeholder="רחוב, מספר בית"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Phone & Website in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            <Phone className="w-4 h-4 inline ml-1 text-indigo-400" />
            טלפון
          </label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="050-1234567"
            dir="ltr"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            <Globe className="w-4 h-4 inline ml-1 text-indigo-400" />
            אתר (אופציונלי)
          </label>
          <input
            type="url"
            value={data.websiteUrl}
            onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
            placeholder="www.example.com"
            dir="ltr"
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
    </div>
  );

  // ── Step 2: About the business ───────────────────────────────────────────

  const renderStep2 = () => (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-4 shadow-xl shadow-blue-500/20">
          <Briefcase className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">על העסק</h2>
        <p className="text-gray-400">עזור לנו להבין את העסק שלך טוב יותר</p>
      </div>

      {/* Business Age */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">כמה זמן העסק פועל?</label>
        <div className="flex flex-wrap gap-3">
          {businessAgeOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleInputChange('businessAge', opt.id)}
              className={`px-5 py-3 rounded-xl border transition-all duration-200 ${
                data.businessAge === opt.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Count */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">כמה עובדים?</label>
        <div className="flex flex-wrap gap-3">
          {employeeCountOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleInputChange('employeeCount', opt.id)}
              className={`px-5 py-3 rounded-xl border transition-all duration-200 ${
                data.employeeCount === opt.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Product/Service */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">מוצר/שירות ראשי</label>
        <input
          type="text"
          value={data.mainProduct}
          onChange={(e) => handleInputChange('mainProduct', e.target.value)}
          placeholder="לדוגמה: עיצוב שיער, פיצה, ייעוץ עסקי..."
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Average Transaction Price */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">מחיר עסקה ממוצע</label>
        <div className="flex flex-wrap gap-3">
          {avgPriceOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleInputChange('avgTransactionPrice', opt.id)}
              className={`px-5 py-3 rounded-xl border transition-all duration-200 ${
                data.avgTransactionPrice === opt.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Step 3: Customers ────────────────────────────────────────────────────

  const renderStep3 = () => (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4 shadow-xl shadow-cyan-500/20">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">הלקוחות שלך</h2>
        <p className="text-gray-400">עזור לנו להבין את קהל היעד שלך</p>
      </div>

      {/* Ideal Customers — multi-select pills */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">מי הלקוח האידיאלי שלך? (בחר כמה שתרצה)</label>
        <div className="flex flex-wrap gap-2">
          {idealCustomerOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleMultiSelect('idealCustomers', opt.id)}
              className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                data.idealCustomers.includes(opt.id)
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discovery Channels — multi-select pills */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">איך לקוחות מוצאים אותך? (בחר כמה שתרצה)</label>
        <div className="flex flex-wrap gap-2">
          {discoveryChannelOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleMultiSelect('discoveryChannels', opt.id)}
              className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                data.discoveryChannels.includes(opt.id)
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Challenge — single select */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">מה האתגר הכי גדול שלך?</label>
        <div className="flex flex-wrap gap-3">
          {challengeOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleInputChange('mainChallenge', opt.id)}
              className={`px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                data.mainChallenge === opt.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Step 4: Setup ────────────────────────────────────────────────────────

  const renderStep4 = () => (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 mb-4 shadow-xl shadow-indigo-500/20">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">הגדרות</h2>
        <p className="text-gray-400">כמעט סיימנו! עוד כמה פרטים אחרונים</p>
      </div>

      {/* Competitors (1-3 text fields) */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          <Target className="w-4 h-4 inline ml-1 text-red-400" />
          מתחרים (עד 3)
        </label>
        {data.competitors.map((comp, i) => (
          <input
            key={i}
            type="text"
            value={comp}
            onChange={(e) => updateCompetitor(i, e.target.value)}
            placeholder={`מתחרה ${i + 1}`}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
        ))}
        <p className="text-xs text-gray-500">נעקוב אחריהם אוטומטית ונתריע על כל מהלך שלהם</p>
      </div>

      {/* WhatsApp Number */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          <MessageCircle className="w-4 h-4 inline ml-1 text-green-400" />
          מספר וואטסאפ
        </label>
        <input
          type="tel"
          value={data.whatsappNumber}
          onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
          placeholder="050-1234567"
          dir="ltr"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Daily Update Time */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">
          <Clock className="w-4 h-4 inline ml-1 text-indigo-400" />
          מתי לשלוח עדכון יומי?
        </label>
        <div className="flex flex-wrap gap-3">
          {dailyUpdateTimeOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleInputChange('dailyUpdateTime', opt.id)}
              className={`px-5 py-3 rounded-xl border transition-all duration-200 ${
                data.dailyUpdateTime === opt.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Submitting overlay ───────────────────────────────────────────────────

  const renderSubmittingOverlay = () => (
    <div className="fixed inset-0 z-50 bg-gray-900/98 backdrop-blur-xl flex items-center justify-center">
      <div className="text-center space-y-6 max-w-lg px-8">
        <div className="relative w-32 h-32 mx-auto">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-4 rounded-full border-2 border-indigo-500/30 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-2xl shadow-blue-500/50">
              <Sparkles className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white">Quieteyes מנתח את העסק שלך...</h2>
        <p className="text-gray-400">זה ייקח רק כמה שניות</p>
        <div className="w-48 mx-auto h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
      </div>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {isSubmitting && renderSubmittingOverlay()}

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Quiet Eyes</h1>
            </div>
            <p className="text-gray-400">מודיעין עסקי מונע AI</p>
          </div>

          {/* Wizard Card */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
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
            {currentStep === 4 && renderStep4()}

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
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>שומר...</span>
                  </>
                ) : currentStep === 4 ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>סיום והתחל</span>
                  </>
                ) : (
                  <>
                    <span>הבא</span>
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
