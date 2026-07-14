import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cometdUrl, LAST_KNOWN_HOSTS } from "./config.js";
import type { Logger } from "./logger.js";

const execFileAsync = promisify(execFile);

/**
 * MT48 は DHCP を使わずリンクローカル (169.254.x.x) で自動採番されるため、
 * 再起動やケーブル抜き差しで IP が変わる。固定 IP を前提にすると、ある日
 * 突然「OSC が来ない」状態になるので、見つからなければ探しに行く。
 */

const HANDSHAKE_BODY = JSON.stringify([
  {
    id: "1",
    version: "1.0",
    minimumVersion: "1.0",
    channel: "/meta/handshake",
    supportedConnectionTypes: ["long-polling"],
  },
]);

/** ARP テーブルから、応答のあったリンクローカル近傍の IP を拾う。 */
async function arpNeighbors(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("arp", ["-a", "-n"]);
    const hosts = new Set<string>();
    for (const line of stdout.split("\n")) {
      // 例: ? (169.254.13.240) at 30:d6:59:c0:63:a6 on en31 [ethernet]
      const match = line.match(/\((169\.254\.\d{1,3}\.\d{1,3})\) at (?!\(incomplete\))/);
      if (match?.[1]) hosts.add(match[1]);
    }
    return [...hosts];
  } catch {
    return [];
  }
}

/** その IP が CometD で応答する MT48 かどうかを、実際にハンドシェイクして確かめる。 */
export async function probe(host: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const response = await fetch(cometdUrl(host), {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: HANDSHAKE_BODY,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return (
      Array.isArray(body) &&
      body.some((reply) => (reply as { successful?: boolean }).successful === true)
    );
  } catch {
    return false;
  }
}

/**
 * MT48 を探す。直近に動いていた IP を先に試し、駄目なら ARP 近傍を総当たりする。
 * 見つからなければ null。
 */
export async function discoverHost(logger: Logger): Promise<string | null> {
  const neighbors = await arpNeighbors();
  const candidates = [...new Set([...LAST_KNOWN_HOSTS, ...neighbors])];

  logger.info(`MT48 を探索中... 候補 ${candidates.length} 件`);
  for (const host of candidates) {
    logger.debug("probe", host);
    if (await probe(host)) {
      logger.info(`MT48 を発見: ${host}`);
      return host;
    }
  }
  return null;
}
