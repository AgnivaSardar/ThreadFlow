const API_BASE = '/api/v1';

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let currentAccessToken: string | null = null;
let isRefreshing = false;

export const setApiAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const getApiAccessToken = () => currentAccessToken;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Includes HttpOnly refresh cookie
    });
  } catch (err: any) {
    throw new ApiError(err.message || 'Network request failed', 0);
  }

  // Handle Token Expiration (401)
  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    if (!endpoint.includes('/auth/refresh') && !isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        const refreshData = await refreshRes.json();

        if (refreshRes.ok && refreshData.accessToken) {
          currentAccessToken = refreshData.accessToken;
          localStorage.setItem('threadflow_token', refreshData.accessToken);
          if (refreshData.user) {
            localStorage.setItem('threadflow_user', JSON.stringify(refreshData.user));
          }
          isRefreshing = false;

          // Retry original request with fresh token
          headers.set('Authorization', `Bearer ${currentAccessToken}`);
          const retryRes = await fetch(url, { ...options, headers, credentials: 'include' });
          const retryData = await retryRes.json().catch(() => ({}));
          if (!retryRes.ok) {
            throw new ApiError(retryData.message || `Request failed (${retryRes.status})`, retryRes.status);
          }
          return retryData as T;
        }
      } catch {
        // Refresh failed
      } finally {
        isRefreshing = false;
      }
    }

    // Unrecoverable 401: clear session and redirect to login automatically
    localStorage.removeItem('threadflow_token');
    localStorage.removeItem('threadflow_user');
    currentAccessToken = null;
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError('Session expired. Redirecting to login...', 401);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || `Request failed with status ${response.status}`, response.status);
  }

  return data as T;
}

/**
 * Server Time Synchronization
 * Fetches server timestamp and derives monotonic offset from performance.now()
 * to protect against local client clock manipulation.
 */
let serverClockOffsetMs = 0;
let hasSyncedServerTime = false;

export async function syncServerTime(): Promise<number> {
  try {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/time`);
    const t1 = performance.now();
    const data = await res.json();
    if (data.serverTimestamp) {
      const roundTrip = (t1 - t0) / 2;
      const accurateServerTimestamp = data.serverTimestamp + roundTrip;
      serverClockOffsetMs = accurateServerTimestamp - performance.now();
      hasSyncedServerTime = true;
      return accurateServerTimestamp;
    }
  } catch {
    // Fallback if network drops
    if (!hasSyncedServerTime) {
      serverClockOffsetMs = Date.now() - performance.now();
    }
  }
  return performance.now() + serverClockOffsetMs;
}

export function getAuthoritativeServerDate(): Date {
  if (!hasSyncedServerTime) {
    return new Date();
  }
  return new Date(performance.now() + serverClockOffsetMs);
}
