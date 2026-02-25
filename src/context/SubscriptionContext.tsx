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
}

interface SubscriptionContextType extends SubscriptionState {
  isPaid: boolean;
  isElite: boolean;
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
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  ...defaultState,
  isPaid: false,
  isElite: false,
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
  const isElite = state.tier === 'elite';

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        isPaid,
        isElite,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
export default SubscriptionContext;
