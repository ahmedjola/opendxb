import { AuthError } from "../core/errors.js";
import { httpFetch } from "../core/http.js";

/**
 * Dubai Pulse OAuth token manager.
 *
 * Pulse issues bearer tokens that expire after roughly 30 minutes. A full DLD
 * transaction ingest takes longer than that, so any straightforward script
 * dies partway through with a 401 — this is the single most cited piece of
 * friction in working with Dubai's open data, and handling it is most of why
 * this package exists.
 *
 * The token is refreshed proactively before expiry and shared across every
 * concurrent request, so a parallel ingest triggers exactly one refresh rather
 * than one per worker.
 */

const DEFAULT_TOKEN_URL = "https://api.dubaipulse.gov.ae/auth/oauth/token";

/** Refresh this long before nominal expiry, to cover clock skew and slow requests. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/** Assumed lifetime when the server does not report one. */
const ASSUMED_LIFETIME_MS = 30 * 60_000;

export interface PulseCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Override for testing or if Pulse moves the endpoint. */
  readonly tokenUrl?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

export class PulseTokenManager {
  #token: string | null = null;
  #expiresAt = 0;
  /** In-flight refresh, shared so concurrent callers do not stampede. */
  #inFlight: Promise<string> | null = null;

  constructor(private readonly credentials: PulseCredentials) {
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new AuthError(
        "Dubai Pulse credentials are required. Set DUBAI_PULSE_CLIENT_ID and " +
          "DUBAI_PULSE_CLIENT_SECRET, or register at https://www.dubaipulse.gov.ae.",
      );
    }
  }

  /** A valid bearer token, refreshing if the current one is near expiry. */
  async getToken(): Promise<string> {
    if (this.#token && Date.now() < this.#expiresAt - REFRESH_MARGIN_MS) return this.#token;
    this.#inFlight ??= this.#refresh().finally(() => { this.#inFlight = null; });
    return this.#inFlight;
  }

  /** Authorization header for a Pulse request. */
  async authHeader(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this.getToken()}` };
  }

  /** Discard the cached token, forcing a refresh on next use. */
  invalidate(): void {
    this.#token = null;
    this.#expiresAt = 0;
  }

  async #refresh(): Promise<string> {
    const url = this.credentials.tokenUrl ?? DEFAULT_TOKEN_URL;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    }).toString();

    let payload: TokenResponse;
    try {
      const response = await httpFetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        authority: "Dubai Pulse",
        retries: 2,
        timeoutMs: 30_000,
      });
      payload = (await response.json()) as TokenResponse;
    } catch (error) {
      throw new AuthError("Failed to obtain a Dubai Pulse access token.", { cause: error });
    }

    if (!payload.access_token) {
      throw new AuthError("Dubai Pulse returned a token response with no access_token.");
    }

    this.#token = payload.access_token;
    const lifetime = payload.expires_in ? payload.expires_in * 1000 : ASSUMED_LIFETIME_MS;
    this.#expiresAt = Date.now() + lifetime;
    return this.#token;
  }
}
