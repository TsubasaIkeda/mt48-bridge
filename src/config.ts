/** 環境変数から実行設定を組み立てる。 */

export interface Config {
  /** MT48 の IP / ホスト名。未指定なら起動時に自動探索する。 */
  host: string | undefined;
  oscHost: string;
  oscPort: number;
  /** メータ系チャネル (高頻度) も購読するか */
  meters: boolean;
  debug: boolean;
}

/** 直近に動いていた IP。自動探索の最初の候補として試す。 */
export const LAST_KNOWN_HOSTS = ["169.254.13.240", "169.254.184.72"] as const;

export const CORE_CHANNELS = ["/ravenna/settings", "/ravenna/status"] as const;
export const METER_CHANNELS = ["/ravenna/meter", "/ravenna/monitoring_meters"] as const;

export const cometdUrl = (host: string): string => `http://${host}/cometd`;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number.parseInt(env.OSC_PORT ?? "7400", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`OSC_PORT が不正です: ${env.OSC_PORT}`);
  }

  return {
    host: env.MT48_HOST,
    oscHost: env.OSC_HOST ?? "127.0.0.1",
    oscPort: port,
    meters: env.METERS === "1",
    debug: env.LOG === "debug",
  };
}
