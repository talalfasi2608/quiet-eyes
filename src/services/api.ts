/**
 * API Service for Quiet Eyes
 * Connects the React frontend to the FastAPI backend
 */

const API_BASE_URL = 'http://localhost:8015';

/**
 * Authenticated fetch wrapper.
 * Automatically injects Bearer token from Supabase session if available.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Try to get the session token from localStorage (Supabase stores it there)
  try {
    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (storageKey) {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const token = stored?.access_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // No token available — continue without auth
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
  const response = await fetch(`${API_BASE_URL}/onboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description,
      user_id: userId,
      address: address || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `API error: ${response.status}`);
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
  const response = await fetch(`${API_BASE_URL}/business/user/${userId}`);

  if (response.status === 404) {
    // User hasn't onboarded yet
    return null;
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
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
  try {
    const response = await fetch(`${API_BASE_URL}/analyze-business`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: text }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: AnalyzeResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to analyze business:', error);
    throw error;
  }
}

/**
 * Scan a competitor and generate alert
 */
export async function scanCompetitor(
  competitorName: string,
  competitorType: string
): Promise<ScanCompetitorResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/scan-competitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        competitor_name: competitorName,
        competitor_type: competitorType,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: ScanCompetitorResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to scan competitor:', error);
    throw error;
  }
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

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}
