import { UpstreamError } from "./errors.js";

export interface HttpOptions {
  /** Per-attempt timeout in milliseconds. Defaults to 60s. */
  readonly timeoutMs?: number;
  /** Retry attempts for transient failures. Defaults to 3. */
  readonly retries?: number;
  /** Label used in error messages, e.g. "DLD". */
  readonly authority?: string;
  readonly headers?: Record<string, string>;
  readonly method?: string;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

/** Status codes worth retrying: transient upstream and rate-limit responses. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with bounded retries and exponential backoff.
 *
 * Dubai Pulse serves multi-hundred-megabyte CSV exports and rate-limits
 * aggressively during business hours, so a single unretried fetch is not a
 * realistic ingestion strategy. `Retry-After` is honoured when present rather
 * than backing off blindly against a server that has told us exactly how long
 * to wait.
 */
export async function httpFetch(url: string, options: HttpOptions = {}): Promise<Response> {
  const {
    timeoutMs = 60_000,
    retries = 3,
    authority = "upstream",
    headers = {},
    method = "GET",
    body,
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal });

      if (response.ok) return response;

      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) {
        const text = await response.text().catch(() => "");
        throw new UpstreamError(authority, response.status, url, text);
      }

      const retryAfter = Number(response.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2 ** attempt * 1000;
      lastError = new UpstreamError(authority, response.status, url);
      await sleep(backoff);
    } catch (error) {
      // A caller-initiated abort is intent, not a transient failure.
      if (signal?.aborted) throw error;
      if (error instanceof UpstreamError && !RETRYABLE_STATUS.has(error.status)) throw error;
      lastError = error;
      if (attempt === retries) break;
      await sleep(2 ** attempt * 1000);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Request to ${url} failed after ${retries + 1} attempts`);
}

/** Fetch and decode as UTF-8 text. */
export async function fetchText(url: string, options?: HttpOptions): Promise<string> {
  const response = await httpFetch(url, options);
  return response.text();
}

/** Fetch and parse as JSON. */
export async function fetchJson<T>(url: string, options?: HttpOptions): Promise<T> {
  const response = await httpFetch(url, options);
  return (await response.json()) as T;
}
