const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((extraHeaders as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Surface structured quota errors
    if (res.status === 402 && body.detail?.code === "QUOTA_EXCEEDED") {
      const err = new Error(body.detail.detail || "Quota exceeded") as Error & {
        code: string;
        resource: string;
        current: number;
        limit: number;
        upgrade_url: string;
      };
      err.code = "QUOTA_EXCEEDED";
      err.resource = body.detail.resource;
      err.current = body.detail.current;
      err.limit = body.detail.limit;
      err.upgrade_url = body.detail.upgrade_url;
      throw err;
    }
    throw new Error(body.detail || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
