/** Base for every error this library raises, so callers can catch one type. */
export class OpenDxbError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A Dubai authority endpoint returned a non-2xx response. */
export class UpstreamError extends OpenDxbError {
  constructor(
    readonly authority: string,
    readonly status: number,
    readonly url: string,
    body?: string,
  ) {
    super(
      `${authority} returned HTTP ${status} for ${url}` +
        (body ? `: ${body.slice(0, 300)}` : ""),
    );
  }
}

/** Credentials are missing, rejected, or the token could not be refreshed. */
export class AuthError extends OpenDxbError {}

/** A source produced rows that do not match its declared schema. */
export class SchemaError extends OpenDxbError {
  constructor(readonly sourceId: string, message: string) {
    super(`Source "${sourceId}" returned unexpected data: ${message}`);
  }
}

/** The caller asked for data that has not been ingested yet. */
export class NotIngestedError extends OpenDxbError {
  constructor(readonly sourceId: string) {
    super(
      `No local data for source "${sourceId}". Run \`opendxb ingest ${sourceId}\` first, ` +
        `or use \`opendxb demo\` to work against the bundled sample.`,
    );
  }
}
