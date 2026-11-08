// every saved record carries a version number, unknown ones get skipped.
export const ENVELOPE_VERSION = 1 as const;

export interface Envelope<T> {
  version: typeof ENVELOPE_VERSION;
  data: T;
}

export function envelope<T>(data: T): Envelope<T> {
  return { version: ENVELOPE_VERSION, data };
}
