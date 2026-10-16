export type LogFields = Readonly<Record<string, string | number | boolean | null>>;
export type LogSink = (line: string) => void;

export interface Logger {
  info(event: string, fields?: LogFields): void;
}

/** Field names whose values are secrets or capabilities (seat tokens, invite codes). */
const SECRET_KEY = /token|code|secret|authorization|cookie/i;

/**
 * Structured JSON logger. Values under secret-looking keys are redacted, and callers only
 * pass fixed event names and small scalar fields: never raw client input or error messages.
 */
export function createLogger(sink: LogSink): Logger {
  return {
    info(event, fields = {}) {
      const safe: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(fields)) {
        safe[key] = SECRET_KEY.test(key) ? "[redacted]" : value;
      }
      sink(JSON.stringify({ event, ...safe }));
    },
  };
}
