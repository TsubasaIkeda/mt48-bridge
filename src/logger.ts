export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createLogger(debugEnabled: boolean): Logger {
  return {
    info: (...args) => console.log("[bridge]", ...args),
    warn: (...args) => console.warn("[warn]  ", ...args),
    error: (...args) => console.error("[error] ", ...args),
    debug: (...args) => {
      if (debugEnabled) console.log("[debug] ", ...args);
    },
  };
}
