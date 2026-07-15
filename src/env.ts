/** 環境変数とログ。 */

const parsePort = (raw: string | undefined, fallback: string, name: string): number => {
  const value = Number.parseInt(raw ?? fallback, 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} が不正です: ${raw}`);
  }
  return value;
};

export const config = {
  /** MT48 の IP / ホスト名 */
  host: process.env.MT48_HOST ?? "192.168.0.22",
  /** OSC 送信先 (MT48 -> Max) */
  oscHost: process.env.OSC_HOST ?? "127.0.0.1",
  oscPort: parsePort(process.env.OSC_PORT, "7400", "OSC_PORT"),
  /** OSC 受信 (Max -> MT48) の待ち受け */
  oscInHost: process.env.OSC_IN_HOST ?? "0.0.0.0",
  oscInPort: parsePort(process.env.OSC_IN_PORT, "7500", "OSC_IN_PORT"),
  /** メータ系チャネル (高頻度) も購読するか */
  meters: process.env.METERS === "1",
  /** 接続が確立できていないときの再 handshake 間隔 (ミリ秒) */
  reconnectInterval: Number.parseInt(process.env.RECONNECT_INTERVAL ?? "30000", 10),
  debug: process.env.LOG === "debug",
} as const;

export const log = {
  info: (...args: unknown[]) => console.log("[bridge]", ...args),
  warn: (...args: unknown[]) => console.warn("[warn]  ", ...args),
  error: (...args: unknown[]) => console.error("[error] ", ...args),
  debug: (...args: unknown[]) => {
    if (config.debug) console.log("[debug] ", ...args);
  },
};
