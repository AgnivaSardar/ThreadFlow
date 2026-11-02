const API_BASE = '/api/v1';

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let currentAccessToken: string | null = null;

export const setApiAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

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

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Includes HttpOnly refresh cookie
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || `Request failed with status ${response.status}`, response.status);
  }

  return data as T;
}
