import { CometD, type Message } from "cometd";
import { adapt } from "cometd-nodejs-client";
import { fetchNames } from "./device-api.js";
import { config, log } from "./env.js";
import { createButtonTracker, type Trigger } from "./hw-buttons.js";
import { toOscMessages } from "./osc-address.js";
import { createOscSender } from "./osc-sender.js";
import { createSourceTracker, type Monitor } from "./sources.js";

// CometD の JS クライアントはブラウザ前提なので、Node 用トランスポートを注入する。
adapt();

const COMETD_URL = `http://${config.host}/cometd`;
const CORE_CHANNELS = ["/ravenna/settings", "/ravenna/status"];
const METER_CHANNELS = ["/ravenna/meter", "/ravenna/monitoring_meters"];

log.info(`MT48 CometD: ${COMETD_URL}`);
log.info(`OSC out:     ${config.oscHost}:${config.oscPort}`);
log.info(`Meters:      ${config.meters ? "ON" : "OFF"}`);

const osc = createOscSender();

// 名前 (モニター名 / ソース名) は MT48 側で変更できるので、焼き込まずに起動時に引く。
const buttons = createButtonTracker(await fetchNames("monitors", "button_id"));
const sources = createSourceTracker(await fetchNames("sources", "id"));

const cometd = new CometD();
cometd.configure({
  url: COMETD_URL,
  logLevel: config.debug ? "info" : "warn",
  maxNetworkDelay: 10_000,
});

// 接続安定性を優先し long-polling に固定する（WebSocket は使わない）。
cometd.unregisterTransport("websocket");
cometd.unregisterTransport("callback-polling");

interface RavennaUpdate {
  path?: string;
  value?: unknown;
}

/** CometD は失敗時に message.failure を生やすが、公式の型定義には含まれていない。 */
const failureOf = (message: Message): unknown => {
  const { failure, error } = message as Message & { failure?: unknown };
  return failure ?? error ?? message;
};

function handle(message: Message): void {
  const data = message.data as RavennaUpdate | undefined;
  if (!data) return;

  // path: "$" は全状態のスナップショット。起動直後に一度だけ、しかも巨大なので
  // 通常は捨てる（デバッグ時のみ流して構造を確認できるようにしておく）。
  if (data.path === "$" && !config.debug) return;

  // ボタンは全 15 個ぶんの LED 状態が、ソースは全モニターの設定が、それぞれ丸ごと
  // 毎回届く。そのまま流すと Max 側で差分を取る羽目になるので、変化分だけを送る。
  const triggers = (data.value as { triggers?: unknown } | undefined)?.triggers;
  if (data.path?.includes("remote_hw_event") && Array.isArray(triggers)) {
    for (const oscMessage of buttons.update(triggers as Trigger[])) osc.send(oscMessage);
    return;
  }

  if (data.path?.endsWith("monitoring.monitors") && Array.isArray(data.value)) {
    for (const oscMessage of sources.update(data.value as Monitor[])) osc.send(oscMessage);
    return;
  }

  for (const oscMessage of toOscMessages(data.path, data.value)) osc.send(oscMessage);
}

let connected = false;
let shuttingDown = false;
let reconnectTimer: ReturnType<typeof setInterval> | undefined;

function subscribeChannels(): void {
  const channels = config.meters ? [...CORE_CHANNELS, ...METER_CHANNELS] : CORE_CHANNELS;
  for (const channel of channels) {
    cometd.subscribe(channel, handle);
    log.info("subscribed", channel);
  }
}

/** 接続が確立できていない間、reconnectInterval ごとに再 handshake を試みる。 */
function startReconnect(): void {
  if (shuttingDown || reconnectTimer) return;
  log.info(`reconnect: ${config.reconnectInterval / 1000}s ごとに再試行します`);
  reconnectTimer = setInterval(() => {
    if (connected || shuttingDown) return; // 接続済み/終了中はスキップ（成功時に停止する）
    log.info("re-handshake を試みます...");
    cometd.handshake({ supportedConnectionTypes: ["long-polling"] });
  }, config.reconnectInterval);
}

function stopReconnect(): void {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = undefined;
  }
}

cometd.addListener("/meta/handshake", (message) => {
  if (message.successful) {
    // 再接続時は clientId が変わり以前の購読は失われるので、毎回購読し直す。
    connected = true;
    stopReconnect();
    log.info("connected, clientId =", cometd.getClientId());
    subscribeChannels();
  } else {
    log.error("handshake 失敗:", failureOf(message));
    connected = false;
    startReconnect();
  }
});
cometd.addListener("/meta/connect", (message) => {
  if (message.successful) {
    // CometD が同一セッションで自動回復した場合は handshake リスナーが発火しないので、
    // ここでも接続状態を戻して手動再接続を止める（購読はセッション内で維持される）。
    connected = true;
    stopReconnect();
  } else {
    log.warn("connect 失敗:", failureOf(message));
    connected = false;
    startReconnect();
  }
});

cometd.handshake({ supportedConnectionTypes: ["long-polling"] });

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  stopReconnect();
  log.info("shutting down...");

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
