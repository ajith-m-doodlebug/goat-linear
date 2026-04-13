const DEFAULT_API_PORT = "8005";

function configuredApiPort(): string {
  const p = (process.env.NEXT_PUBLIC_API_PORT || DEFAULT_API_PORT).trim();
  return p || DEFAULT_API_PORT;
}

/**
 * Base URL for browser → FastAPI. Uses the page hostname + API port (from
 * `NEXT_PUBLIC_API_PORT`, set at **build** from `RAGLINE_API_PORT` in Compose).
 * If `NEXT_PUBLIC_API_URL` is set to a full URL (advanced / reverse-proxy), that wins.
 */
export function getApiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_API_URL?.trim() ||
      `http://127.0.0.1:${configuredApiPort()}`
    );
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const port = configuredApiPort();
  const pageHost = window.location.hostname;
  const pageIsLocal = pageHost === "localhost" || pageHost === "127.0.0.1";

  if (!configured) {
    return `${window.location.protocol}//${pageHost}:${port}`;
  }

  try {
    const u = new URL(configured);
    const cfgLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (cfgLocal && !pageIsLocal) {
      const apiPort = u.port || port;
      return `${window.location.protocol}//${pageHost}:${apiPort}`;
    }
    return configured;
  } catch {
    return `${window.location.protocol}//${pageHost}:${port}`;
  }
}

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
  const res = await fetch(`${getApiBase()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: ref }),
  });
  if (!res.ok) return false;
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

type FetchOptions = NonNullable<Parameters<typeof fetch>[1]>;

export async function apiRequest<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { accessToken: token } = getStoredTokens();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  const base = getApiBase();
  let res = await fetch(`${base}${path}`, { ...options, headers });

  if (res.status === 401 && path !== "/api/v1/auth/refresh" && path !== "/api/v1/auth/login") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const { accessToken: newToken } = getStoredTokens();
      (headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${base}${path}`, { ...options, headers });
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
  refresh: (refresh_token: string) =>
    apiRequest<TokenResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
  me: () => apiRequest<UserResponse>("/api/v1/auth/me"),
};

export type SetupStatusResponse = { setup_completed: boolean };

export const setupApi = {
  getStatus: async (): Promise<SetupStatusResponse> => {
    const r = await fetch(`${getApiBase()}/api/v1/setup/status`);
    if (!r.ok) {
      throw new Error(`setup status HTTP ${r.status}`);
    }
    const data = (await r.json()) as SetupStatusResponse;
    if (typeof data.setup_completed !== "boolean") {
      throw new Error("setup status: invalid response");
    }
    return data;
  },
  runSetup: (body: {
    super_admin_email: string;
    password: string;
    setup_default_prompt: boolean;
  }) =>
    fetch(`${getApiBase()}/api/v1/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => {
      if (!r.ok) {
        return r.json().then((err) => {
          const d = err.detail;
          const msg =
            typeof d === "string"
              ? d
              : Array.isArray(d)
                ? d.map((x: { msg?: string }) => x.msg).filter(Boolean).join(", ")
                : "Setup failed";
          throw new Error(msg || "Setup failed");
        });
      }
      return r.json();
    }),
};

export async function createUserAsSuperAdmin(body: {
  email: string;
  password: string;
  role: string;
}): Promise<UserResponse> {
  return apiRequest<UserResponse>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
