import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getBusinessByUserId } from '../services/api';
import type { BusinessProfile as ApiBusinessProfile } from '../services/api';

// ============ TYPES ============
export interface FeedCard {
  id: string;
  type: 'alert' | 'opportunity';
  title: string;
  description: string;
  actionButtonText: string;
}

export interface WeeklyStat {
  label: string;
  value: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  nameHebrew: string;
  archetype: 'Visual' | 'Expert' | 'Field' | 'Merchant';
  pulseScore: number;
  pulseChange: string;
  cards: FeedCard[];
  weeklyStats: WeeklyStat[];
  trendingTopics: string[];
  emoji: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  business_name?: string;
}

// ============ API RESPONSE TYPE ============
export interface ApiCard {
  id: string;
  type: 'alert' | 'opportunity';
  title: string;
  description: string;
  action_button_text: string;
  priority: number;
  source: string;
}

export interface ApiProfile {
  id: string;
  name_hebrew: string;
  archetype: string;
  emoji: string;
  pulse_score: number;
  pulse_change: string;
  trending_topics: string[];
  description: string;
}

// ============ CONTEXT ============
interface SimulationContextType {
  currentProfile: BusinessProfile | null;
  setProfile: (profile: BusinessProfile) => void;
  setProfileFromAPI: (profile: ApiProfile, cards: ApiCard[]) => void;
  setProfileFromBusiness: (business: ApiBusinessProfile) => void;
  hasCompletedOnboarding: boolean;
  isLoadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  profileError: string | null;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentProfile, setCurrentProfile] = useState<BusinessProfile | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch business profile when user is available
  useEffect(() => {
    if (user?.id) {
      fetchUserBusiness(user.id);
    } else {
      // No user — reset everything to clean state
      setCurrentProfile(null);
      setHasCompletedOnboarding(false);
      setIsLoadingProfile(false);
      setProfileError(null);
    }
  }, [user?.id]);

  const fetchUserBusiness = async (userId: string) => {
    setIsLoadingProfile(true);
    setProfileError(null);

    try {
      // ONLY use real data from the backend — no mock/fallback data ever
      const business = await getBusinessByUserId(userId);

      if (business) {
        setProfileFromBusiness(business);
        setHasCompletedOnboarding(true);
        console.log('✅ Loaded business profile:', business.name_hebrew);
      } else {
        // 404 — user hasn't onboarded yet. Keep state clean.
        setCurrentProfile(null);
        setHasCompletedOnboarding(false);
        console.log('📋 User needs to complete onboarding');
      }
    } catch (error) {
      // API error — do NOT load mock data. Show error state.
      console.error('Failed to fetch user business:', error);
      setCurrentProfile(null);
      setHasCompletedOnboarding(false);
      setProfileError('לא נמצא עסק. אנא השלם את ההרשמה.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserBusiness(user.id);
    }
  };

  const setProfile = (profile: BusinessProfile) => {
    setCurrentProfile(profile);
    setHasCompletedOnboarding(true);
    setProfileError(null);
  };

  // Set profile from onboarding API response
  const setProfileFromAPI = (apiProfile: ApiProfile, apiCards: ApiCard[]) => {
    const cards: FeedCard[] = apiCards.map(card => ({
      id: card.id,
      type: card.type,
      title: card.title,
      description: card.description,
      actionButtonText: card.action_button_text,
    }));

    const archetypeMap: Record<string, 'Visual' | 'Expert' | 'Field' | 'Merchant'> = {
      'Visual': 'Visual',
      'Expert': 'Expert',
      'Field': 'Field',
      'Merchant': 'Merchant',
    };
    const archetype = archetypeMap[apiProfile.archetype] || 'Merchant';

    const newProfile: BusinessProfile = {
      id: apiProfile.id,
      name: apiProfile.name_hebrew,
      nameHebrew: apiProfile.name_hebrew,
      archetype,
      pulseScore: apiProfile.pulse_score,
      pulseChange: apiProfile.pulse_change || '+0.0',
      emoji: apiProfile.emoji,
      cards,
      weeklyStats: [
        { label: 'פעולות', value: '0' },
        { label: 'התראות', value: String(apiCards.filter(c => c.type === 'alert').length) },
        { label: 'הזדמנויות', value: String(apiCards.filter(c => c.type === 'opportunity').length) },
      ],
      trendingTopics: apiProfile.trending_topics,
    };

    setCurrentProfile(newProfile);
    setHasCompletedOnboarding(true);
    setProfileError(null);
  };

  // Set profile from database business record — ONLY real data
  const setProfileFromBusiness = (business: ApiBusinessProfile) => {
    const archetypeMap: Record<string, 'Visual' | 'Expert' | 'Field' | 'Merchant'> = {
      'Visual': 'Visual',
      'Expert': 'Expert',
      'Field': 'Field',
      'Merchant': 'Merchant',
    };
    const archetype = archetypeMap[business.archetype] || 'Merchant';

    const newProfile: BusinessProfile = {
      id: business.id,
      name: business.name_hebrew,
      nameHebrew: business.name_hebrew,
      archetype,
      pulseScore: business.pulse_score,
      pulseChange: '+0.0',
      emoji: business.emoji,
      cards: [],
      weeklyStats: [
        { label: 'תעשייה', value: business.industry },
        { label: 'קהל יעד', value: business.target_audience || 'כללי' },
        { label: 'ציון', value: String(business.pulse_score) },
      ],
      trendingTopics: business.trending_topics || [],
      location: business.location,
      address: business.address,
      latitude: business.latitude || 0,
      longitude: business.longitude || 0,
      business_name: business.name_hebrew,
    };

    setCurrentProfile(newProfile);
    setHasCompletedOnboarding(true);
    setProfileError(null);
  };

  return (
    <SimulationContext.Provider
      value={{
        currentProfile,
        setProfile,
        setProfileFromAPI,
        setProfileFromBusiness,
        hasCompletedOnboarding,
        isLoadingProfile,
        refreshProfile,
        profileError,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
