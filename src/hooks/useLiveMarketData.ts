/**
 * useLiveMarketData - Supabase Realtime hook for live dashboard updates.
 *
 * Subscribes to INSERT/UPDATE events on:
 *   - leads_discovered
 *   - competitors
 *   - strategy_feed
 * Filtered by business_id matching the current user's business.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RealtimeEvent {
  table: 'leads_discovered' | 'competitors' | 'strategy_feed';
  eventType: 'INSERT' | 'UPDATE';
  record: Record<string, any>;
  timestamp: string;
}

export interface LiveMarketData {
  /** New leads that arrived since mount */
  newLeads: Record<string, any>[];
  /** New competitors that arrived since mount */
  newCompetitors: Record<string, any>[];
  /** New strategy feed items that arrived since mount */
  newStrategyItems: Record<string, any>[];
  /** Whether the realtime channel is connected */
  isConnected: boolean;
  /** Last event received */
  lastEvent: RealtimeEvent | null;
  /** Clear accumulated items (e.g. after user has seen them) */
  clearNewItems: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLiveMarketData(businessId: string | null | undefined): LiveMarketData {
  const [newLeads, setNewLeads] = useState<Record<string, any>[]>([]);
  const [newCompetitors, setNewCompetitors] = useState<Record<string, any>[]>([]);
  const [newStrategyItems, setNewStrategyItems] = useState<Record<string, any>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const clearNewItems = useCallback(() => {
    setNewLeads([]);
    setNewCompetitors([]);
    setNewStrategyItems([]);
  }, []);

  useEffect(() => {
    if (!businessId) return;

    // Create a single channel that listens to all three tables
    const channel = supabase
      .channel(`market-data-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads_discovered',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, any>;
          setNewLeads((prev) => [record, ...prev]);
          setLastEvent({
            table: 'leads_discovered',
            eventType: 'INSERT',
            record,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'competitors',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, any>;
          setNewCompetitors((prev) => [record, ...prev]);
          setLastEvent({
            table: 'competitors',
            eventType: 'INSERT',
            record,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'competitors',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, any>;
          setLastEvent({
            table: 'competitors',
            eventType: 'UPDATE',
            record,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'strategy_feed',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, any>;
          setNewStrategyItems((prev) => [record, ...prev]);
          setLastEvent({
            table: 'strategy_feed',
            eventType: 'INSERT',
            record,
            timestamp: new Date().toISOString(),
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [businessId]);

  return {
    newLeads,
    newCompetitors,
    newStrategyItems,
    isConnected,
    lastEvent,
    clearNewItems,
  };
}
