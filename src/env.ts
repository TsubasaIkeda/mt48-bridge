/** 環境変数とログ。 */

const port = Number.parseInt(process.env.OSC_PORT ?? "7400", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`OSC_PORT が不正です: ${process.env.OSC_PORT}`);
}

export const config = {
  /** MT48 の IP / ホスト名 */
  host: process.env.MT48_HOST ?? "192.168.100.124",
  oscHost: process.env.OSC_HOST ?? "127.0.0.1",
  oscPort: port,
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
