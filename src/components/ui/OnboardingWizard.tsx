import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import {
  Check,
  Loader2,
  Eye,
  ArrowLeft,
  ArrowRight,
  Search,
  ChevronDown,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { loadGoogleMaps } from '../../lib/googleMaps';

// ── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPE_GROUPS = [
  {
    label: '\u{1F35C} \u05DE\u05D6\u05D5\u05DF \u05D5\u05DE\u05E1\u05E2\u05D3\u05D5\u05EA',
    options: [
      { value: 'restaurant', label: '\u05DE\u05E1\u05E2\u05D3\u05D4' },
      { value: 'cafe', label: '\u05D1\u05D9\u05EA \u05E7\u05E4\u05D4' },
      { value: 'fastfood', label: '\u05DE\u05D6\u05D5\u05DF \u05DE\u05D4\u05D9\u05E8' },
      { value: 'catering', label: '\u05E7\u05D9\u05D9\u05D8\u05E8\u05D9\u05E0\u05D2' },
    ],
  },
  {
    label: '\u{1F487} \u05D9\u05D5\u05E4\u05D9 \u05D5\u05D8\u05D9\u05E4\u05D5\u05D7',
    options: [
      { value: 'hair_salon', label: '\u05E1\u05DC\u05D5\u05DF \u05E9\u05D9\u05E2\u05E8' },
      { value: 'beauty_salon', label: '\u05DE\u05DB\u05D5\u05DF \u05D9\u05D5\u05E4\u05D9' },
      { value: 'cosmetician', label: '\u05E7\u05D5\u05E1\u05DE\u05D8\u05D9\u05E7\u05D0\u05D9\u05EA' },
      { value: 'spa', label: '\u05E1\u05E4\u05D0' },
    ],
  },
  {
    label: '\u{1F3CB}\uFE0F \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA \u05D5\u05DB\u05D5\u05E9\u05E8',
    options: [
      { value: 'gym', label: '\u05D7\u05D3\u05E8 \u05DB\u05D5\u05E9\u05E8' },
      { value: 'pilates_yoga', label: '\u05E1\u05D8\u05D5\u05D3\u05D9\u05D5 \u05E4\u05D9\u05DC\u05D0\u05D8\u05D9\u05E1/\u05D9\u05D5\u05D2\u05D4' },
      { value: 'personal_trainer', label: '\u05DE\u05D0\u05DE\u05DF \u05D0\u05D9\u05E9\u05D9' },
      { value: 'clinic', label: '\u05E7\u05DC\u05D9\u05E0\u05D9\u05E7\u05D4' },
    ],
  },
  {
    label: '\u{1F3E0} \u05E0\u05D3\u05DC"\u05DF',
    options: [
      { value: 'real_estate_agency', label: '\u05E1\u05D5\u05DB\u05E0\u05D5\u05EA \u05E0\u05D3\u05DC"\u05DF' },
      { value: 'contractor', label: '\u05E7\u05D1\u05DC\u05DF' },
      { value: 'appraiser', label: '\u05E9\u05DE\u05D0\u05D9' },
    ],
  },
  {
    label: '\u{1F6D2} \u05DE\u05E1\u05D7\u05E8',
    options: [
      { value: 'physical_store', label: '\u05D7\u05E0\u05D5\u05EA \u05E4\u05D9\u05D6\u05D9\u05EA' },
      { value: 'online_store', label: '\u05D7\u05E0\u05D5\u05EA \u05D0\u05D5\u05E0\u05DC\u05D9\u05D9\u05DF' },
      { value: 'wholesale', label: '\u05E1\u05D9\u05D8\u05D5\u05E0\u05D0\u05D9' },
    ],
  },
  {
    label: '\u{1F4E2} \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05D9\u05DD',
    options: [
      { value: 'marketing_agency', label: '\u05E1\u05D5\u05DB\u05E0\u05D5\u05EA \u05E9\u05D9\u05D5\u05D5\u05E7' },
      { value: 'law_firm', label: '\u05DE\u05E9\u05E8\u05D3 \u05E2\u05D5"\u05D3' },
      { value: 'accountant', label: '\u05E8\u05D5\u05D0\u05D4 \u05D7\u05E9\u05D1\u05D5\u05DF' },
      { value: 'business_consultant', label: '\u05D9\u05D5\u05E2\u05E5 \u05E2\u05E1\u05E7\u05D9' },
    ],
  },
  {
    label: '\u{1F527} \u05D0\u05D7\u05E8',
    options: [
      { value: 'other', label: '\u05D0\u05D7\u05E8 (\u05D4\u05DB\u05E0\u05E1 \u05D9\u05D3\u05E0\u05D9\u05EA)' },
    ],
  },
];

const PRIORITY_OPTIONS = [
  { id: 'leads', icon: '\u{1F3AF}', title: '\u05DC\u05D9\u05D3\u05D9\u05DD \u05D7\u05DE\u05D9\u05DD', desc: '\u05DE\u05E6\u05D0 \u05D0\u05E0\u05E9\u05D9\u05DD \u05E9\u05DE\u05D7\u05E4\u05E9\u05D9\u05DD \u05D1\u05D3\u05D9\u05D5\u05E7 \u05D0\u05EA \u05DE\u05D4 \u05E9\u05D0\u05EA\u05D4 \u05DE\u05E6\u05D9\u05E2' },
  { id: 'competitors', icon: '\u{1F441}\uFE0F', title: '\u05DE\u05E2\u05E7\u05D1 \u05DE\u05EA\u05D7\u05E8\u05D9\u05DD', desc: '\u05D3\u05E2 \u05DE\u05D4 \u05D4\u05DE\u05EA\u05D7\u05E8\u05D9\u05DD \u05E9\u05DC\u05DA \u05E2\u05D5\u05E9\u05D9\u05DD \u05DC\u05E4\u05E0\u05D9 \u05DB\u05D5\u05DC\u05DD' },
  { id: 'reviews', icon: '\u2B50', title: '\u05E0\u05D9\u05D8\u05D5\u05E8 \u05D1\u05D9\u05E7\u05D5\u05E8\u05D5\u05EA', desc: '\u05E2\u05E7\u05D5\u05D1 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05D1\u05D9\u05E7\u05D5\u05E8\u05D5\u05EA \u05E9\u05DC\u05DA \u05D5\u05E9\u05DC \u05D4\u05DE\u05EA\u05D7\u05E8\u05D9\u05DD' },
  { id: 'ads', icon: '\u{1F4E2}', title: '\u05DE\u05E2\u05E7\u05D1 \u05DE\u05D5\u05D3\u05E2\u05D5\u05EA', desc: '\u05E8\u05D0\u05D4 \u05D0\u05D9\u05DC\u05D5 \u05DE\u05D5\u05D3\u05E2\u05D5\u05EA \u05D4\u05DE\u05EA\u05D7\u05E8\u05D9\u05DD \u05DE\u05E8\u05D9\u05E6\u05D9\u05DD' },
  { id: 'prices', icon: '\u{1F4B0}', title: '\u05E0\u05D9\u05D8\u05D5\u05E8 \u05DE\u05D7\u05D9\u05E8\u05D9\u05DD', desc: '\u05D4\u05EA\u05E8\u05D0\u05D4 \u05DB\u05E9\u05DE\u05EA\u05D7\u05E8\u05D4 \u05DE\u05E9\u05E0\u05D4 \u05DE\u05D7\u05D9\u05E8\u05D9\u05DD' },
  { id: 'new_businesses', icon: '\u{1F195}', title: '\u05E2\u05E1\u05E7\u05D9\u05DD \u05D7\u05D3\u05E9\u05D9\u05DD', desc: '\u05D3\u05E2 \u05DB\u05E9\u05E2\u05E1\u05E7 \u05D7\u05D3\u05E9 \u05E0\u05E4\u05EA\u05D7 \u05D1\u05D0\u05D6\u05D5\u05E8\u05DA' },
];

const RADIUS_OPTIONS: { label: string; value: number }[] = [
  { label: '0.5 \u05E7"\u05DE', value: 0.5 },
  { label: '1 \u05E7"\u05DE', value: 1 },
  { label: '2 \u05E7"\u05DE', value: 2 },
  { label: '5 \u05E7"\u05DE', value: 5 },
  { label: '10 \u05E7"\u05DE', value: 10 },
  { label: '\u05D0\u05E8\u05E6\u05D9', value: 999 },
];

const STEP_LABELS = ['\u05E4\u05E8\u05D8\u05D9 \u05D4\u05E2\u05E1\u05E7', '\u05E2\u05D3\u05D9\u05E4\u05D5\u05D9\u05D5\u05EA', '\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA'];

const WIZARD_STORAGE_KEY = 'qe_wizard_progress';

// ── Types ────────────────────────────────────────────────────────────────────

interface WizardStep1Data {
  businessName: string;
  businessType: string;
  customBusinessType: string;
  address: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
}

interface WizardStep2Data {
  priorities: string[];
}

interface AlertPrefs {
  dailySummary: boolean;
  hotLead: boolean;
  competitorChange: boolean;
  newBusiness: boolean;
  weeklyReport: boolean;
}

interface WizardStep3Data {
  alerts: AlertPrefs;
  morningTime: string;
  phone: string;
}

interface WizardProgress {
  currentStep: number;
  step1: WizardStep1Data;
  step2: WizardStep2Data;
  step3: WizardStep3Data;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRegistrationData() {
  try {
    const raw = localStorage.getItem('qe_registration_data');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function loadWizardProgress(): WizardProgress | null {
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveWizardProgress(progress: WizardProgress) {
  try {
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(progress));
  } catch { /* ignore */ }
}

function getAllOptions() {
  const all: { value: string; label: string }[] = [];
  for (const group of BUSINESS_TYPE_GROUPS) {
    for (const opt of group.options) {
      all.push(opt);
    }
  }
  return all;
}

function getOptionLabel(value: string): string {
  const all = getAllOptions();
  const found = all.find(o => o.value === value);
  return found ? found.label : value;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { refreshProfile } = useSimulation();
  const navigate = useNavigate();

  // Registration data from localStorage
  const regData = getRegistrationData();

  // Saved wizard progress
  const saved = loadWizardProgress();

  // Current step
  const [currentStep, setCurrentStep] = useState(saved?.currentStep ?? 1);

  // Step 1 state
  const [businessName, setBusinessName] = useState(saved?.step1?.businessName ?? '');
  const [businessType, setBusinessType] = useState(saved?.step1?.businessType ?? '');
  const [customBusinessType, setCustomBusinessType] = useState(saved?.step1?.customBusinessType ?? '');
  const [address, setAddress] = useState(saved?.step1?.address ?? '');
  const [lat, setLat] = useState<number | null>(saved?.step1?.lat ?? null);
  const [lng, setLng] = useState<number | null>(saved?.step1?.lng ?? null);
  const [radiusKm, setRadiusKm] = useState(saved?.step1?.radiusKm ?? 2);

  // Step 1 UI state
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(
    localStorage.getItem('qe_business_id') || null
  );

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownSearchRef = useRef<HTMLInputElement>(null);

  // Google Places
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Step 2 state
  const [priorities, setPriorities] = useState<string[]>(saved?.step2?.priorities ?? []);
  const [step2Error, setStep2Error] = useState('');

  // Step 3 state
  const [alertPrefs, setAlertPrefs] = useState<AlertPrefs>(
    saved?.step3?.alerts ?? {
      dailySummary: true,
      hotLead: true,
      competitorChange: true,
      newBusiness: true,
      weeklyReport: false,
    }
  );
  const [morningTime, setMorningTime] = useState(saved?.step3?.morningTime ?? '08:00');
  const [phone, setPhone] = useState(saved?.step3?.phone || regData?.phone || '');
  const [editingPhone, setEditingPhone] = useState(false);

  // Step 3 saving
  const [step3Loading, setStep3Loading] = useState(false);

  // Completion
  const [completed, setCompleted] = useState(false);

  // ── Auto-save wizard progress ──────────────────────────────────────────

  useEffect(() => {
    const progress: WizardProgress = {
      currentStep,
      step1: { businessName, businessType, customBusinessType, address, lat, lng, radiusKm },
      step2: { priorities },
      step3: { alerts: alertPrefs, morningTime, phone },
    };
    saveWizardProgress(progress);
  }, [currentStep, businessName, businessType, customBusinessType, address, lat, lng, radiusKm, priorities, alertPrefs, morningTime, phone]);

  // ── Google Maps init ───────────────────────────────────────────────────

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsLoaded(true))
      .catch((err) => console.error('Google Maps load error:', err));
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !addressInputRef.current || autocompleteRef.current) return;

    try {
      const ac = new google.maps.places.Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: 'il' },
        fields: ['formatted_address', 'geometry', 'name'],
      });

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place.formatted_address) {
          setAddress(place.formatted_address);
        } else if (place.name) {
          setAddress(place.name);
        }
        if (place.geometry?.location) {
          setLat(place.geometry.location.lat());
          setLng(place.geometry.location.lng());
        }
      });

      autocompleteRef.current = ac;
    } catch (err) {
      console.error('Autocomplete init error:', err);
    }
  }, [mapsLoaded, currentStep]);

  // ── Dropdown click outside ─────────────────────────────────────────────

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setDropdownSearch('');
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (dropdownOpen && dropdownSearchRef.current) {
      dropdownSearchRef.current.focus();
    }
  }, [dropdownOpen]);

  // ── Step 1: Validate and submit ────────────────────────────────────────

  const validateStep1 = (): string | null => {
    if (!businessName.trim() || businessName.trim().length < 2 || businessName.trim().length > 50) {
      return '\u05E9\u05DD \u05D4\u05E2\u05E1\u05E7 \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA \u05D1\u05D9\u05DF 2 \u05DC-50 \u05EA\u05D5\u05D5\u05D9\u05DD';
    }
    if (!businessType) {
      return '\u05D9\u05E9 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E1\u05D5\u05D2 \u05E2\u05E1\u05E7';
    }
    if (businessType === 'other' && !customBusinessType.trim()) {
      return '\u05D9\u05E9 \u05DC\u05D4\u05DB\u05E0\u05D9\u05E1 \u05E1\u05D5\u05D2 \u05E2\u05E1\u05E7 \u05D9\u05D3\u05E0\u05D9\u05EA';
    }
    if (!address.trim()) {
      return '\u05D9\u05E9 \u05DC\u05D4\u05DB\u05E0\u05D9\u05E1 \u05DB\u05EA\u05D5\u05D1\u05EA \u05E2\u05E1\u05E7';
    }
    if (lat === null || lng === null) {
      return '\u05D9\u05E9 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05D4\u05E8\u05E9\u05D9\u05DE\u05D4 \u05E9\u05DC Google';
    }
    return null;
  };

  const handleStep1Next = async () => {
    const err = validateStep1();
    if (err) {
      setStep1Error(err);
      return;
    }
    setStep1Error('');
    setStep1Loading(true);

    try {
      const response = await apiFetch('/onboard/wizard', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user?.id,
          business_name: businessName.trim(),
          address,
          industry: businessType === 'other' ? customBusinessType.trim() : businessType,
          phone: phone || regData?.phone || '',
          first_name: regData?.firstName || regData?.first_name || '',
          last_name: regData?.lastName || regData?.last_name || '',
          business_type: businessType,
          activity_radius_km: radiusKm,
          latitude: lat,
          longitude: lng,
        }),
      });

      if (!response.ok) throw new Error('Failed to create business');

      const result = await response.json();
      const bId = result.business_id;
      localStorage.setItem('qe_business_id', bId);
      setBusinessId(bId);
      setStep1Loading(false);
      setCurrentStep(2);
    } catch (error) {
      console.error('Step 1 API error:', error);
      setStep1Error('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DE\u05D9\u05E8\u05EA \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1.');
      setStep1Loading(false);
    }
  };

  // ── Step 2: Validate and continue ──────────────────────────────────────

  const handleStep2Next = () => {
    if (priorities.length === 0) {
      setStep2Error('\u05D9\u05E9 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05DC\u05E4\u05D7\u05D5\u05EA \u05E2\u05D3\u05D9\u05E4\u05D5\u05EA \u05D0\u05D7\u05EA');
      return;
    }
    if (priorities.length > 3) {
      setStep2Error('\u05E0\u05D9\u05EA\u05DF \u05DC\u05D1\u05D7\u05D5\u05E8 \u05E2\u05D3 3 \u05E2\u05D3\u05D9\u05E4\u05D5\u05D9\u05D5\u05EA');
      return;
    }
    setStep2Error('');
    setCurrentStep(3);
  };

  const togglePriority = (id: string) => {
    setPriorities(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setStep2Error('');
  };

  // ── Step 3: Save and complete ──────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    const bId = businessId || localStorage.getItem('qe_business_id');
    if (!bId) return;

    setStep3Loading(true);

    try {
      await apiFetch(`/business/profile/${bId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          notification_whatsapp: alertPrefs.dailySummary || alertPrefs.hotLead || alertPrefs.competitorChange || alertPrefs.newBusiness,
          notification_email: true,
          notification_weekly_report: alertPrefs.weeklyReport,
          morning_alert_time: morningTime,
          whatsapp_number: phone,
          onboarding_completed: true,
        }),
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }

    localStorage.setItem('qe_onboarding_done', 'true');
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    setStep3Loading(false);
    setCompleted(true);
  }, [businessId, alertPrefs, morningTime, phone]);

  const handleSkipStep3 = useCallback(async () => {
    const bId = businessId || localStorage.getItem('qe_business_id');
    if (!bId) {
      localStorage.setItem('qe_onboarding_done', 'true');
      localStorage.removeItem(WIZARD_STORAGE_KEY);
      setCompleted(true);
      return;
    }

    setStep3Loading(true);
    try {
      await apiFetch(`/business/profile/${bId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          notification_whatsapp: false,
          notification_email: true,
          notification_weekly_report: false,
          morning_alert_time: '08:00',
          whatsapp_number: phone,
          onboarding_completed: true,
        }),
      });
    } catch (err) {
      console.error('Failed to save preferences on skip:', err);
    }

    localStorage.setItem('qe_onboarding_done', 'true');
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    setStep3Loading(false);
    setCompleted(true);
  }, [businessId, phone]);

  // ── Completion: auto-redirect ──────────────────────────────────────────

  useEffect(() => {
    if (!completed) return;

    const timer = setTimeout(async () => {
      await refreshProfile();
      navigate('/dashboard/focus');
    }, 2500);

    return () => clearTimeout(timer);
  }, [completed, refreshProfile, navigate]);

  // ── Filtered dropdown groups ───────────────────────────────────────────

  const filteredGroups = BUSINESS_TYPE_GROUPS.map(group => ({
    ...group,
    options: group.options.filter(opt =>
      opt.label.includes(dropdownSearch)
    ),
  })).filter(group => group.options.length > 0);

  // ── Toggle alert pref ──────────────────────────────────────────────────

  const toggleAlert = (key: keyof AlertPrefs) => {
    setAlertPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Mask phone ─────────────────────────────────────────────────────────

  const maskPhone = (p: string): string => {
    const digits = p.replace(/\D/g, '');
    if (digits.length < 7) return p;
    return digits.slice(0, 3) + '-' + 'X'.repeat(digits.length - 7) + 'XX-' + digits.slice(-4);
  };

  // ── Step indicator ─────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-10">
      {[1, 2, 3].map((stepNum, index) => (
        <div key={stepNum} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${
                stepNum === currentStep
                  ? 'bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/30 scale-110'
                  : stepNum < currentStep
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}
            >
              {stepNum < currentStep ? <Check className="w-6 h-6" /> : stepNum}
            </div>
            <span
              className={`mt-2 text-xs sm:text-sm font-medium text-center max-w-[80px] sm:max-w-none ${
                stepNum === currentStep ? 'text-cyan-400' : stepNum < currentStep ? 'text-emerald-400' : 'text-gray-500'
              }`}
            >
              {STEP_LABELS[index]}
            </span>
          </div>
          {index < 2 && (
            <div
              className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-4 transition-colors duration-300 ${
                stepNum < currentStep ? 'bg-emerald-500' : 'bg-gray-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // ── Step 1 Render ──────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{'\u05E1\u05E4\u05E8 \u05DC\u05E0\u05D5 \u05E2\u05DC \u05D4\u05E2\u05E1\u05E7 \u05E9\u05DC\u05DA'}</h2>
      </div>

      <div className="space-y-6">
        {/* Business Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{'\u05E9\u05DD \u05D4\u05E2\u05E1\u05E7'}</label>
          <input
            type="text"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder={'\u05DC\u05D3\u05D5\u05D2\u05DE\u05D4: \u05DE\u05E1\u05E2\u05D3\u05EA \u05D4\u05D9\u05DD, \u05E1\u05DC\u05D5\u05DF \u05D9\u05D5\u05E4\u05D9 \u05E9\u05E8\u05D4'}
            maxLength={50}
            className="w-full px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* Business Type — Custom Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{'\u05E1\u05D5\u05D2 \u05E2\u05E1\u05E7'}</label>
          <div ref={dropdownRef} className="relative">
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900/60 border text-right transition-all ${
                dropdownOpen
                  ? 'border-cyan-500/50 ring-1 ring-cyan-500/30'
                  : 'border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <span className={businessType ? 'text-white' : 'text-gray-500'}>
                {businessType ? getOptionLabel(businessType) : '\u05D1\u05D7\u05E8 \u05E1\u05D5\u05D2 \u05E2\u05E1\u05E7'}
              </span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div className="absolute z-50 top-full mt-2 w-full bg-gray-800 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden" style={{ maxHeight: '320px' }}>
                {/* Search */}
                <div className="p-3 border-b border-gray-700/50">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      ref={dropdownSearchRef}
                      type="text"
                      value={dropdownSearch}
                      onChange={e => setDropdownSearch(e.target.value)}
                      placeholder={'\u05D7\u05E4\u05E9...'}
                      className="w-full pr-10 pl-3 py-2 rounded-lg bg-gray-900/60 border border-gray-700/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="overflow-y-auto" style={{ maxHeight: '256px' }}>
                  {filteredGroups.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">{'\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA'}</div>
                  )}
                  {filteredGroups.map(group => (
                    <div key={group.label}>
                      <div className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-900/30 select-none">
                        {group.label}
                      </div>
                      {group.options.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setBusinessType(opt.value);
                            setDropdownOpen(false);
                            setDropdownSearch('');
                            if (opt.value !== 'other') {
                              setCustomBusinessType('');
                            }
                          }}
                          className={`w-full text-right px-6 py-2.5 text-sm transition-colors hover:bg-cyan-500/10 ${
                            businessType === opt.value
                              ? 'text-cyan-400 bg-cyan-500/5'
                              : 'text-gray-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom type input */}
          {businessType === 'other' && (
            <input
              type="text"
              value={customBusinessType}
              onChange={e => setCustomBusinessType(e.target.value)}
              placeholder={'\u05D4\u05DB\u05E0\u05E1 \u05E1\u05D5\u05D2 \u05E2\u05E1\u05E7'}
              className="w-full mt-3 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          )}
        </div>

        {/* Business Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{'\u05DB\u05EA\u05D5\u05D1\u05EA \u05D4\u05E2\u05E1\u05E7'}</label>
          <input
            ref={addressInputRef}
            type="text"
            value={address}
            onChange={e => {
              setAddress(e.target.value);
              // If user manually types, invalidate lat/lng
              setLat(null);
              setLng(null);
            }}
            placeholder={'\u05D4\u05DB\u05E0\u05E1 \u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05DC\u05D0\u05D4'}
            className="w-full px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* Activity Radius */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{'\u05E2\u05D3 \u05DB\u05DE\u05D4 \u05E8\u05D7\u05D5\u05E7 \u05D4\u05DE\u05EA\u05D7\u05E8\u05D9\u05DD \u05E9\u05DC\u05DA \u05E8\u05DC\u05D5\u05D5\u05E0\u05D8\u05D9\u05D9\u05DD?'}</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {RADIUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRadiusKm(opt.value)}
                className={`py-2.5 px-2 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  radiusKm === opt.value
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {step1Error && (
        <p className="mt-4 text-red-400 text-sm text-center">{step1Error}</p>
      )}

      {/* Next button */}
      <button
        onClick={handleStep1Next}
        disabled={step1Loading}
        className="w-full mt-8 flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {step1Loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <span>{'\u05D4\u05DE\u05E9\u05DA \u05DC\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0'} &rarr;</span>
            <ArrowLeft className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );

  // ── Step 2 Render ──────────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{'\u05DE\u05D4 \u05D4\u05DB\u05D9 \u05D7\u05E9\u05D5\u05D1 \u05DC\u05DA \u05DC\u05D3\u05E2\u05EA?'}</h2>
        <p className="text-gray-400">{'\u05E0\u05EA\u05D0\u05D9\u05DD \u05D0\u05EA \u05D4\u05E1\u05E8\u05D9\u05E7\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D4\u05E2\u05D3\u05D9\u05E4\u05D5\u05D9\u05D5\u05EA \u05E9\u05DC\u05DA'}</p>
      </div>

      {/* Priority cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {PRIORITY_OPTIONS.map(opt => {
          const selected = priorities.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => togglePriority(opt.id)}
              className={`relative p-4 rounded-xl border text-right transition-all duration-200 hover:scale-[1.02] ${
                selected
                  ? 'bg-cyan-500/10 border-cyan-500/50'
                  : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600/50'
              }`}
            >
              {/* Check icon */}
              {selected && (
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              <div className="text-3xl mb-2">{opt.icon}</div>
              <div className="text-white font-semibold text-sm mb-1">{opt.title}</div>
              <div className="text-gray-500 text-xs leading-relaxed">{opt.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {step2Error && (
        <p className="mb-4 text-red-400 text-sm text-center">{step2Error}</p>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleStep2Next}
          className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all"
        >
          <span>{'\u05D4\u05DE\u05E9\u05DA'} &rarr;</span>
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setCurrentStep(1)}
          className="w-full flex items-center justify-center gap-2 px-8 py-3 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          <span>&larr; {'\u05D7\u05D6\u05E8\u05D4'}</span>
        </button>

        <button
          onClick={() => {
            setPriorities([]);
            setCurrentStep(3);
          }}
          className="text-gray-600 text-sm hover:text-gray-400 transition-colors mx-auto"
        >
          {'\u05D3\u05DC\u05D2'}
        </button>
      </div>
    </div>
  );

  // ── Step 3 Render ──────────────────────────────────────────────────────

  const ALERT_TOGGLES: { key: keyof AlertPrefs; label: string; timing: string }[] = [
    { key: 'dailySummary', label: '\u05E1\u05D9\u05DB\u05D5\u05DD \u05D1\u05D5\u05E7\u05E8 \u05D9\u05D5\u05DE\u05D9', timing: '\u05DB\u05DC \u05D9\u05D5\u05DD \u05D1-08:00' },
    { key: 'hotLead', label: '\u05DC\u05D9\u05D3 \u05D7\u05DD \u05D7\u05D3\u05E9', timing: '\u05DE\u05D9\u05D9\u05D3\u05D9' },
    { key: 'competitorChange', label: '\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D0\u05E6\u05DC \u05DE\u05EA\u05D7\u05E8\u05D4', timing: '\u05DE\u05D9\u05D9\u05D3\u05D9' },
    { key: 'newBusiness', label: '\u05E2\u05E1\u05E7 \u05D7\u05D3\u05E9 \u05D1\u05D0\u05D6\u05D5\u05E8\u05DA', timing: '\u05DE\u05D9\u05D9\u05D3\u05D9' },
    { key: 'weeklyReport', label: '\u05D3\u05D5\u05D7 \u05E9\u05D1\u05D5\u05E2\u05D9', timing: '\u05DB\u05DC \u05D9\u05D5\u05DD \u05E8\u05D0\u05E9\u05D5\u05DF \u05D1-09:00' },
  ];

  const timeOptions = ['07:00', '08:00', '09:00', '10:00'];

  const renderStep3 = () => (
    <div className="animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{'\u05DE\u05EA\u05D9 \u05DC\u05E9\u05DC\u05D5\u05D7 \u05DC\u05DA \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA?'}</h2>
        <p className="text-gray-400">{'\u05E0\u05E9\u05DC\u05D7 \u05DC\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4 \u05E9\u05DC\u05DA \u05E8\u05E7 \u05DE\u05D4 \u05E9\u05D7\u05E9\u05D5\u05D1'}</p>
      </div>

      {/* Phone display */}
      <div className="mb-6 p-4 rounded-xl bg-gray-900/40 border border-gray-700/40">
        {editingPhone ? (
          <div className="flex items-center gap-3">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
              dir="ltr"
              placeholder="05X-XXXXXXX"
            />
            <button
              onClick={() => setEditingPhone(false)}
              className="text-cyan-400 text-sm font-medium hover:text-cyan-300 transition-colors"
            >
              {'\u05E9\u05DE\u05D5\u05E8'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">
              {'\u05D4\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05D9\u05D9\u05E9\u05DC\u05D7\u05D5 \u05DC:'}{' '}
              <span className="text-white font-medium" dir="ltr">{maskPhone(phone)}</span>
              {' '}<span className="text-emerald-400">{'\u2713'}</span>
            </span>
            <button
              onClick={() => setEditingPhone(true)}
              className="text-cyan-400 text-xs hover:text-cyan-300 transition-colors underline"
            >
              {'\u05E9\u05E0\u05D4 \u05DE\u05E1\u05E4\u05E8'}
            </button>
          </div>
        )}
      </div>

      {/* Alert toggles */}
      <div className="space-y-3 mb-8">
        {ALERT_TOGGLES.map(toggle => (
          <div
            key={toggle.key}
            className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
              alertPrefs[toggle.key]
                ? 'bg-cyan-500/5 border-cyan-500/30'
                : 'bg-gray-800/40 border-gray-700/50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">{toggle.label}</span>
                <span className="text-gray-600 text-xs">&mdash; {toggle.timing}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleAlert(toggle.key)}
              className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                alertPrefs[toggle.key] ? 'bg-cyan-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                  alertPrefs[toggle.key] ? 'left-1' : 'left-6'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Morning time */}
      <div className="mb-8">
        <span className="block text-sm font-medium text-gray-300 mb-3">{'\u05E9\u05E2\u05EA \u05D4\u05E1\u05D9\u05DB\u05D5\u05DD \u05D4\u05D9\u05D5\u05DE\u05D9:'}</span>
        <div className="grid grid-cols-4 gap-3">
          {timeOptions.map(time => (
            <button
              key={time}
              type="button"
              onClick={() => setMorningTime(time)}
              className={`py-3 rounded-xl border text-center font-medium transition-all duration-200 ${
                morningTime === time
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleFinish}
          disabled={step3Loading}
          className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step3Loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <span>{'\u05E1\u05D9\u05D9\u05DD \u05D4\u05D2\u05D3\u05E8\u05D4 \u2014 \u05D4\u05EA\u05D7\u05DC \u05DC\u05E1\u05E8\u05D5\u05E7!'} {'\u{1F680}'}</span>
          )}
        </button>

        <button
          onClick={() => setCurrentStep(2)}
          className="w-full flex items-center justify-center gap-2 px-8 py-3 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          <span>&larr; {'\u05D7\u05D6\u05E8\u05D4'}</span>
        </button>

        <button
          onClick={handleSkipStep3}
          disabled={step3Loading}
          className="text-gray-600 text-sm hover:text-gray-400 transition-colors mx-auto disabled:opacity-50"
        >
          {'\u05D3\u05DC\u05D2'}
        </button>
      </div>
    </div>
  );

  // ── Completion screen ──────────────────────────────────────────────────

  const renderCompletion = () => (
    <div className="animate-fadeIn text-center py-8">
      {/* Success animation */}
      <div className="relative w-28 h-28 mx-auto mb-8">
        <div
          className="absolute inset-0 rounded-full bg-cyan-500/20"
          style={{ animation: 'celebrationPulse 2s ease-in-out infinite' }}
        />
        <div
          className="absolute inset-3 rounded-full bg-cyan-500/15"
          style={{ animation: 'celebrationPulse 2s ease-in-out 0.3s infinite' }}
        />
        <div className="absolute inset-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/40">
          <Check className="w-10 h-10 text-white" />
        </div>
      </div>

      <h2 className="text-3xl font-bold text-white mb-3">{'\u05DE\u05E2\u05D5\u05DC\u05D4! \u05DE\u05EA\u05D7\u05D9\u05DC\u05D9\u05DD \u05DC\u05E1\u05E8\u05D5\u05E7 \u05D0\u05EA \u05D4\u05E9\u05D5\u05E7 \u05E9\u05DC\u05DA...'}</h2>
      <p className="text-gray-400 mb-8 leading-relaxed">{'\u05D4\u05E1\u05E8\u05D9\u05E7\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4 \u05EA\u05D5\u05E9\u05DC\u05DD \u05EA\u05D5\u05DA 12 \u05E9\u05E2\u05D5\u05EA'}</p>

      <div className="flex items-center justify-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{'\u05DE\u05E2\u05D1\u05D9\u05E8 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA...'}</span>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800" style={{ fontFamily: 'Heebo, sans-serif' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="wizard-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,212,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wizard-grid)" />
        </svg>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 sm:p-6">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 mb-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Quiet Eyes</h1>
            </div>
          </div>

          {/* Wizard Card */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {!completed && renderStepIndicator()}

            {/* Step Content */}
            {completed
              ? renderCompletion()
              : currentStep === 1
              ? renderStep1()
              : currentStep === 2
              ? renderStep2()
              : renderStep3()
            }
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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes celebrationPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// ── Type declarations ────────────────────────────────────────────────────────

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
