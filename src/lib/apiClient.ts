import { supabase } from './supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8015';

function getTokenFromStorage(): string | null {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (key) {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      return stored?.access_token || null;
    }
  } catch { /* ignore */ }
  return null;
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let token: string | undefined;

  // Primary: SDK (handles refresh)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch { /* ignore */ }

  // Fallback: localStorage (avoids async race)
  if (!token) {
    token = getTokenFromStorage() || undefined;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    }
  });
}

export async function apiGet(endpoint: string) {
  const res = await apiCall(endpoint);
  if (!res.ok) throw new Error(`${res.status}: ${endpoint}`);
  return res.json();
}

export async function apiPost(endpoint: string, body: unknown) {
  const res = await apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status}: ${endpoint}`);
  return res.json();
}

export async function apiPatch(endpoint: string, body: unknown) {
  const res = await apiCall(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status}: ${endpoint}`);
  return res.json();
}
