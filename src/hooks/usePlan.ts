/**
 * usePlan — React hook for granular plan permission checking.
 *
 * Wraps SubscriptionContext + calls GET /billing/permissions for
 * feature-level limits and usage data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { apiFetch } from '../services/api';

interface PlanPermissions {
  plan_id: string;
  plan_name: string;
  limits: Record<string, number | boolean | string>;
  usage: Record<string, number>;
}

export function usePlan() {
  const subscription = useSubscription();
  const [permissions, setPermissions] = useState<PlanPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await apiFetch('/billing/permissions');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data);
      }
    } catch {
      // silent — fallback to subscription context
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subscription.isLoading) return;
    fetchPermissions();
  }, [subscription.isLoading, subscription.tier, fetchPermissions]);

  const plan = permissions?.plan_id || subscription.planId || 'free';
  const limits = permissions?.limits || {};
  const usage = permissions?.usage || {};

  /**
   * Check if the user can use a feature.
   * - boolean limits: returns the boolean value
   * - numeric -1 (unlimited): returns true
   * - numeric >= 0: returns used < limit
   */
  const canUse = (feature: string): boolean => {
    const limit = limits[feature];
    if (limit === undefined || limit === null) return true;
    if (typeof limit === 'boolean') return limit;
    if (typeof limit === 'string') return true; // support_level etc.
    if (limit === -1) return true; // unlimited
    const used = usage[feature] || 0;
    return used < limit;
  };

  /**
   * Get usage percentage for a count-based feature (for progress bars).
   * Returns 0 for boolean/string/unlimited features.
   */
  const getUsagePercent = (feature: string): number => {
    const limit = limits[feature];
    if (typeof limit !== 'number' || limit <= 0) return 0;
    const used = usage[feature] || 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  /**
   * Get remaining count for a feature.
   * Returns null for boolean/string features, -1 for unlimited.
   */
  const getRemaining = (feature: string): number | null => {
    const limit = limits[feature];
    if (typeof limit !== 'number') return null;
    if (limit === -1) return -1;
    const used = usage[feature] || 0;
    return Math.max(0, limit - used);
  };

  const getPlanName = (): string => {
    return permissions?.plan_name || subscription.tierName || 'Free';
  };

  const isFeatureLocked = (feature: string): boolean => {
    return !canUse(feature);
  };

  return {
    plan,
    limits,
    usage,
    canUse,
    getUsagePercent,
    getRemaining,
    getPlanName,
    isFeatureLocked,
    isLoading: isLoading || subscription.isLoading,
    refreshPermissions: fetchPermissions,
  };
}
