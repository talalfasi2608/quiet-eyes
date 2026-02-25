/**
 * API Service for Quiet Eyes
 * Connects the React frontend to the FastAPI backend
 */

import { API_BASE as API_BASE_URL } from '../config/api';
import { supabase } from '../lib/supabaseClient';

/**
 * Authenticated fetch wrapper.
 * Primary: Supabase SDK getSession() (handles refresh automatically).
 * Fallback: read token directly from localStorage (synchronous, avoids
 *           the race condition where the SDK hasn't finished restoring
 *           the session yet on initial page load).
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Try 1: Supabase SDK (handles token refresh)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // SDK call failed — fall through to localStorage
  }

  // Try 2: Direct localStorage read (synchronous fallback for race conditions)
  if (!headers['Authorization']) {
    try {
      const storageKey = Object.keys(localStorage).find(
        k => k.startsWith('sb-') && k.endsWith('-auth-token')
      );
      if (storageKey) {
        const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (stored?.access_token) {
          headers['Authorization'] = `Bearer ${stored.access_token}`;
        }
      }
    } catch {
      // No token available
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

export interface AnalyzeResponse {
  profile: {
    id: string;
    name_hebrew: string;
    archetype: string;
    emoji: string;
    pulse_score: number;
    pulse_change: string;
    trending_topics: string[];
    description: string;
  };
  cards: Array<{
    id: string;
    type: 'alert' | 'opportunity';
    title: string;
    description: string;
    action_button_text: string;
    priority: number;
    source: string;
  }>;
  success: boolean;
  message: string;
}

export interface ScanCompetitorResponse {
  card: {
    id: string;
    type: string;
    title: string;
    description: string;
    action_button_text: string;
    priority: number;
    source: string;
  };
  scan_summary: string;
  success: boolean;
}

export interface BusinessProfile {
  id: string;
  user_id: string;
  name_hebrew: string;
  industry: string;
  archetype: string;
  target_audience: string;
  emoji: string;
  trending_topics: string[];
  core_metrics: Array<{ name: string; description: string }>;
  pulse_score: number;
  created_at?: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface OnboardResponse {
  success: boolean;
  message: string;
  business: BusinessProfile;
}

export interface GetBusinessResponse {
  success: boolean;
  business: BusinessProfile;
}

/**
 * Onboard a new business (linked to Supabase Auth user)
 */
export async function onboardBusiness(
  description: string,
  userId: string,
  address?: string
): Promise<OnboardResponse> {
  const response = await apiFetch('/onboard', {
    method: 'POST',
    body: JSON.stringify({
      description,
      user_id: userId,
      address: address || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'שגיאת שרת');
  }

  return response.json();
}

/**
 * Get business profile by Supabase Auth user ID
 * Returns null if user hasn't completed onboarding (404)
 */
export async function getBusinessByUserId(
  userId: string
): Promise<BusinessProfile | null> {
  const response = await apiFetch(`/business/user/${userId}`);

  if (response.status === 404) {
    // User hasn't onboarded yet
    return null;
  }

  if (!response.ok) {
    throw new Error('שגיאת שרת');
  }

  const data: GetBusinessResponse = await response.json();
  return data.business;
}

/**
 * Analyze a business description using AI
 */
export async function analyzeBusinessText(
  text: string,
  _type: string = 'General'
): Promise<AnalyzeResponse> {
  const response = await apiFetch('/analyze-business', {
    method: 'POST',
    body: JSON.stringify({ description: text }),
  });

  if (!response.ok) {
    throw new Error('שגיאת שרת');
  }

  return response.json();
}

/**
 * Scan a competitor and generate alert
 */
export async function scanCompetitor(
  competitorName: string,
  competitorType: string
): Promise<ScanCompetitorResponse> {
  const response = await apiFetch('/scan-competitor', {
    method: 'POST',
    body: JSON.stringify({
      competitor_name: competitorName,
      competitor_type: competitorType,
    }),
  });

  if (!response.ok) {
    throw new Error('שגיאת שרת');
  }

  return response.json();
}

/**
 * Health check
 */
export async function checkHealth(): Promise<{ status: string; ai_available: boolean }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

// ============ AI COO CHAT ============

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  business_name?: string;
  competitors_count?: number;
  suggested_questions?: string[];
  intelligence_summary?: {
    insights_30d: number;
    competitor_moves_7d: number;
    leads_tracked: number;
    memory_messages: number;
  };
}

/**
 * Send a message to the AI COO Chat endpoint
 * The AI has full context of the user's business and competitors from the database
 */
export async function sendChatMessage(
  userId: string,
  message: string,
  promptTemplateId?: number
): Promise<ChatResponse> {
  const body: Record<string, unknown> = { user_id: userId, message };
  if (promptTemplateId) body.prompt_template_id = promptTemplateId;

  const response = await apiFetch('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'שגיאת שרת');
  }

  return response.json();
}
