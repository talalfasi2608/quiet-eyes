import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/api';

interface SubscriptionState {
  tier: string;
  tierName: string;
  creditsRemaining: number;
  creditsLimit: number;
  creditsResetAt: string | null;
  status: string;
  hasStripe: boolean;
  isLoading: boolean;
  planId: string;
  billingInterval: 'monthly' | 'yearly';
  trialEndsAt: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  isPaid: boolean;
  isElite: boolean;
  isTrial: boolean;
  isBusiness: boolean;
  isBetaUser: boolean;
  trialDaysRemaining: number;
  isTrialExpired: boolean;
  refreshSubscription: () => Promise<void>;
}

const defaultState: SubscriptionState = {
  tier: 'free',
  tierName: 'Free',
  creditsRemaining: 10,
  creditsLimit: 10,
  creditsResetAt: null,
  status: 'active',
  hasStripe: false,
  isLoading: true,
  planId: 'free',
  billingInterval: 'monthly',
  trialEndsAt: null,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  ...defaultState,
  isPaid: false,
  isElite: false,
  isTrial: false,
  isBusiness: false,
  isBetaUser: false,
  trialDaysRemaining: 0,
  isTrialExpired: false,
  refreshSubscription: async () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<SubscriptionState>(defaultState);

  const fetchSubscription = async () => {
    if (!session?.access_token) {
      setState({ ...defaultState, isLoading: false });
      return;
    }

    try {
      const res = await apiFetch('/billing/status');

      if (res.ok) {
        const data = await res.json();
        setState({
          tier: data.tier || 'free',
          tierName: data.tier_name || 'Free',
          creditsRemaining: data.credits_remaining ?? 10,
          creditsLimit: data.credits_monthly_limit ?? 10,
          creditsResetAt: data.credits_reset_at,
          status: data.status || 'active',
          hasStripe: data.has_stripe || false,
          isLoading: false,
          planId: data.plan_id || data.tier || 'free',
          billingInterval: data.billing_interval || 'monthly',
          trialEndsAt: data.trial_ends_at || null,
        });
      } else {
        setState({ ...defaultState, isLoading: false });
      }
    } catch {
      setState({ ...defaultState, isLoading: false });
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [session?.access_token]);

  const isPaid = state.tier !== 'free';
  const isElite = state.tier === 'elite' || state.tier === 'business';
  const isBusiness = state.tier === 'business' || state.tier === 'elite';

  // Check if currently in trial
  const isTrial = (() => {
    if (!state.trialEndsAt) return false;
    try {
      return new Date(state.trialEndsAt) > new Date();
    } catch {
      return false;
    }
  })();

  const trialDaysRemaining = (() => {
    if (!state.trialEndsAt) return 0;
    try {
      const diff = new Date(state.trialEndsAt).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  })();

  const isTrialExpired = (() => {
    if (!state.trialEndsAt) return false;
    try {
      return new Date(state.trialEndsAt) <= new Date() && state.tier === 'free';
    } catch {
      return false;
    }
  })();

  // Check beta user status from localStorage (set during beta onboarding)
  const isBetaUser = (() => {
    try {
      return !!localStorage.getItem('qe_beta_activated_at');
    } catch {
      return false;
    }
  })();

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        isPaid,
        isElite,
        isTrial,
        isBusiness,
        isBetaUser,
        trialDaysRemaining,
        isTrialExpired,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
export default SubscriptionContext;
