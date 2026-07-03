// ============================================================
// SEERA PLATFORM v4 - Shared CORS origin validator
// Single source of truth for which origins may talk to the API,
// used by both the REST server (main.ts) and the WebSocket gateway.
// ============================================================

export type CorsOriginCallback = (
  err: Error | null,
  allow?: boolean,
) => void;

/**
 * Reads CORS configuration from the environment.
 *  - CORS_ORIGINS: comma-separated explicit allow-list.
 *  - CORS_ALLOW_ALL=true: allow every origin (debug only).
 * Any *.railway.app / *.up.railway.app origin is always auto-allowed so a
 * fresh Railway deploy works before CORS_ORIGINS is configured.
 */
export function getCorsConfig(): { origins: string[]; allowAll: boolean } {
  const origins = (
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowAll = process.env.CORS_ALLOW_ALL === 'true';
  return { origins, allowAll };
}

/** True when the given Origin header is permitted. No Origin ⇒ allowed. */
export function isOriginAllowed(
  origin: string | undefined,
  origins: string[],
  allowAll: boolean,
): boolean {
  // Non-browser clients (no Origin) and explicit allow-all.
  if (!origin || allowAll) return true;

  if (origins.includes(origin)) return true;

  let hostname = '';
  try {
    hostname = new URL(origin).hostname;
  } catch {
    hostname = '';
  }
  return /\.(up\.)?railway\.app$/i.test(hostname);
}

/**
 * A socket.io / cors-compatible origin callback that applies the same
 * allow-list logic used by the REST server.
 */
export function createCorsOriginValidator(): (
  origin: string | undefined,
  callback: CorsOriginCallback,
) => void {
  const { origins, allowAll } = getCorsConfig();
  return (origin, callback) => {
    if (isOriginAllowed(origin, origins, allowAll)) {
      return callback(null, true);
    }
    return callback(null, false);
  };
}
