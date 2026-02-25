const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserResponse = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }
}

export function loadTokensFromStorage() {
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("access_token");
    refreshToken = localStorage.getItem("refresh_token");
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
}

function getStoredTokens() {
  if (typeof window === "undefined") return { accessToken, refreshToken };
  return {
    accessToken: accessToken ?? localStorage.getItem("access_token"),
    refreshToken: refreshToken ?? localStorage.getItem("refresh_token"),
  };
}

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken: ref } = getStoredTokens();
  if (!ref) return false;
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: ref }),
  });
  if (!res.ok) return false;
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken: token } = getStoredTokens();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && path !== "/api/v1/auth/refresh" && path !== "/api/v1/auth/login") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const { accessToken: newToken } = getStoredTokens();
      (headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, full_name?: string) =>
    apiRequest<UserResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),
  refresh: (refresh_token: string) =>
    apiRequest<TokenResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
  me: () => apiRequest<UserResponse>("/api/v1/auth/me"),
};
