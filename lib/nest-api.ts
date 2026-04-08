/**
 * Returns the Nest API base URL (no trailing slash) + the versioned prefix.
 *
 * Set `NEXT_PUBLIC_NEST_API_URL` in `.env.local` (or the deployment env) to
 * the scheme+host of your deployed backend, e.g.
 *   NEXT_PUBLIC_NEST_API_URL=https://api.myapp.com
 *
 * In production NEVER hard-code a hostname here — always use the env var.
 * The empty-string fallback lets relative requests work when the frontend
 * is served from the same origin as the backend (same-host deploys).
 */
const API_PREFIX = "/api/v1";

export function getNestApiBase(): string {
  const override =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_NEST_API_URL
      ? process.env.NEXT_PUBLIC_NEST_API_URL.replace(/\/$/, "")
      : "";
  return `${override}${API_PREFIX}`;
}
