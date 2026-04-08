import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  isAxiosError,
} from "axios";
import { getNestApiBase } from "./nest-api";

const TOKEN_KEY = "excel_voice_access_token";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const p = window.location.pathname;
  if (p === "/login" || p === "/signup") return;
  window.location.href = "/login?toast=session";
}

// ─── Shared axios instance ────────────────────────────────────────────────────

/**
 * Pre-configured axios instance that points at the Nest API base.
 * The baseURL is resolved at call-time via `getNestApiBase()` so it always
 * picks up the current env var value (important for SSR/browser split).
 */
function createApiClient() {
  const instance = axios.create({
    baseURL: getNestApiBase(),
    headers: { "Content-Type": "application/json" },
  });

  // Attach Bearer token on every request (browser only)
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // On 401 clear the token and redirect to login
  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (isAxiosError(error) && error.response?.status === 401) {
        clearAccessToken();
        redirectToLogin();
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export const apiClient = createApiClient();

// ─── nestFetch (drop-in axios wrapper) ───────────────────────────────────────

/**
 * Calls the Nest API with a Bearer token when present.
 * Returns an axios `AxiosResponse` so callers can do `res.data` instead of
 * `await res.json()`.  On 401 it clears the token and redirects to `/login`.
 *
 * @param path   API path, e.g. `/excel-workbooks` or `/auth/me`.
 *               Do NOT include the base URL — that is added automatically.
 * @param config Optional axios request config (method, data, headers, …).
 */
export async function nestFetch<T = unknown>(
  path: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const response = await apiClient.request<T>({
    url: path,
    ...config,
  });
  return response;
}
