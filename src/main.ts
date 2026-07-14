import { CometD, type Message } from "cometd";
import { adapt } from "cometd-nodejs-client";
import { CORE_CHANNELS, cometdUrl, loadConfig, METER_CHANNELS } from "./config.js";
import { fetchNames } from "./device-api.js";
import { discoverHost } from "./discover.js";
import { createButtonTracker, type Trigger } from "./hw-buttons.js";
import { createLogger } from "./logger.js";
import { toOscMessages } from "./osc-address.js";
import { createOscSender } from "./osc-sender.js";
import { createSourceTracker, type Monitor } from "./sources.js";

// CometD の JS クライアントはブラウザ前提なので、Node 用トランスポートを注入する。
adapt();

const config = loadConfig();
const logger = createLogger(config.debug);

const host = config.host ?? (await discoverHost(logger));
if (!host) {
  logger.error("MT48 が見つかりません。MT48_HOST=<IP> を指定するか、接続を確認してください。");
  process.exit(1);
}

logger.info(`MT48 CometD: ${cometdUrl(host)}`);
logger.info(`OSC out:     ${config.oscHost}:${config.oscPort}`);
logger.info(`Meters:      ${config.meters ? "ON" : "OFF"}`);

const osc = createOscSender(config.oscHost, config.oscPort, logger);

const cometd = new CometD();
cometd.configure({
  url: cometdUrl(host),
  logLevel: config.debug ? "info" : "warn",
  maxNetworkDelay: 10_000,
});

// 接続安定性を優先し long-polling に固定する（WebSocket は使わない）。
cometd.unregisterTransport("websocket");
cometd.unregisterTransport("callback-polling");
logger.info("CometD transport: long-polling (forced)");

interface RavennaUpdate {
  path?: string;
  value?: unknown;
}

/** CometD は失敗時に message.failure を生やすが、公式の型定義には含まれていない。 */
type FailureMessage = Message & { failure?: unknown };

const failureOf = (message: Message): unknown => {
  const { failure, error } = message as FailureMessage;
  return failure ?? error ?? message;
};

// 名前 (ソース名 / モニター名) は MT48 側で変更できるので、焼き込まずに起動時に引く。
const buttons = createButtonTracker(await fetchNames(host, "monitors", "button_id", logger));
const sources = createSourceTracker(await fetchNames(host, "sources", "id", logger));

/** フロントパネルのボタン状態か？（押下は色の変化としてしか届かない） */
function asTriggers(data: RavennaUpdate): Trigger[] | null {
  if (!data.path?.includes("remote_hw_event")) return null;
  const triggers = (data.value as { triggers?: unknown } | undefined)?.triggers;
  return Array.isArray(triggers) ? (triggers as Trigger[]) : null;
}

/** 全モニターの設定配列か？（ソース切り替えはこの中の source_id_list に出る） */
function asMonitors(data: RavennaUpdate): Monitor[] | null {
  if (!data.path?.endsWith("monitoring.monitors")) return null;
  return Array.isArray(data.value) ? (data.value as Monitor[]) : null;
}

function handle(message: Message): void {
  const data = message.data as RavennaUpdate | undefined;
  if (!data) return;

  // path: "$" は全状態のスナップショット。起動直後に一度だけ、しかも巨大なので
  // 通常は捨てる（デバッグ時のみ流して構造を確認できるようにしておく）。
  if (data.path === "$" && !config.debug) return;

  // ボタンは全 15 個ぶんの LED 状態がまとめて届く。そのまま流すと Max 側で
  // 差分を取る羽目になるので、変化したボタンだけを送る。
  const triggers = asTriggers(data);
  if (triggers) {
    for (const oscMessage of buttons.update(triggers)) {
      osc.send(oscMessage);
    }
    return;
  }

  // monitors は全モニターの設定が丸ごと届く（巨大）。ソース以外は使わないので、
  // 生のまま流さずソースの変化だけを送る。
  const monitors = asMonitors(data);
  if (monitors) {
    for (const oscMessage of sources.update(monitors)) {
      osc.send(oscMessage);
    }
    return;
  }

  for (const oscMessage of toOscMessages(data.path, data.value)) {
    osc.send(oscMessage);
  }
}

cometd.addListener("/meta/handshake", (message) => {
  if (!message.successful) logger.error("handshake 失敗:", failureOf(message));
});

let transportReported = false;
cometd.addListener("/meta/connect", (message) => {
  if (!message.successful) {
    logger.warn("connect 失敗:", failureOf(message));
    return;
  }
  if (!transportReported) {
    logger.info("connected transport =", message.connectionType ?? "long-polling");
    transportReported = true;
  }
});

cometd.addListener("/meta/disconnect", (message) =>
  logger.info("disconnected:", message.successful),
);

cometd.handshake({ supportedConnectionTypes: ["long-polling"] }, (reply) => {
  if (!reply.successful) {
    logger.error("handshake 失敗:", failureOf(reply));
    return;
  }
  logger.info("connected, clientId =", cometd.getClientId());

  const channels = config.meters ? [...CORE_CHANNELS, ...METER_CHANNELS] : [...CORE_CHANNELS];
  for (const channel of channels) {
    cometd.subscribe(channel, handle);
    logger.info("subscribed", channel);
  }
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("shutting down...");

  // disconnect が返らないまま吊られることがあるので、猶予を切って必ず終わらせる。
  await Promise.race([
    new Promise<void>((resolve) => cometd.disconnect(() => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
  await osc.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
