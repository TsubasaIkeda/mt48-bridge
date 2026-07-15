import { log } from "./env.js";
import type { OscArg } from "./osc-address.js";

/**
 * OSC 受信 (Max -> MT48) を CometD の publish へ変換する。
 *
 * 書き込みは WebUI と同じく `/service/ravenna/settings` へ `{ path, value }` を
 * publish する方式（実機で確認済み）。ここでは対応する OSC アドレスだけを受け付け、
 * 未知のアドレスは無視する（誤爆で実機を触らないため、ホワイトリスト方式）。
 *
 *   /mt48/main/mute       1|0      -> speaker_set { mute: bool }
 *   /mt48/main/volume     <0.1dB>  -> speaker_set { volume: int }
 *   /mt48/phone/<n>/volume <0.1dB> -> monitors[?(@.id==<id>)][0] { volume: int }
 *
 * volume は実機の生値（0.1dB 単位の整数）。WebUI と同じ範囲 [-960, +120] に丸める。
 */

const SPEAKER_SET = "$._oem_ui_process_engine.monitoring.speaker_set";
const monitorPath = (id: number): string =>
  `$._oem_ui_process_engine.monitoring.monitors[?(@.id==${id})][0]`;

/** モニター volume の範囲（WebUI の clamp と同じ。0.1dB 単位）。 */
const VOLUME_MIN = -960;
const VOLUME_MAX = 120;

const clampVolume = (value: number): number =>
  Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, Math.round(value)));

/** CometD の publish 実体。main 側で `/service/ravenna/settings` に流す。 */
export type PublishFn = (path: string, value: Record<string, unknown>) => void;

export interface Controller {
  /** 受信した 1 メッセージを処理する。対応アドレスなら publish する。 */
  handle: (address: string, args: readonly OscArg[]) => void;
}

/** 先頭引数を数値として取り出す（bool は 1/0 として扱う）。無ければ undefined。 */
function firstNumber(args: readonly OscArg[]): number | undefined {
  const arg = args[0] as { value?: unknown } | undefined;
  if (!arg) return undefined;
  if (typeof arg.value === "number") return arg.value;
  if (typeof arg.value === "boolean") return arg.value ? 1 : 0;
  if (typeof arg.value === "string") {
    const parsed = Number.parseFloat(arg.value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * @param publish       CometD publish 実体
 * @param phoneMonitors Phone 番号 -> モニター ID（起動時に device から解決）
 */
export function createController(
  publish: PublishFn,
  phoneMonitors: ReadonlyMap<number, number>,
): Controller {
  const PHONE_VOLUME = /^\/mt48\/phone\/(\d+)\/volume$/;

  return {
    handle(address, args) {
      // --- メイン Mute ---
      if (address === "/mt48/main/mute") {
        const value = firstNumber(args);
        if (value === undefined) {
          log.warn("control: /mt48/main/mute に数値引数がありません");
          return;
        }
        const mute = value !== 0;
        publish(SPEAKER_SET, { mute });
        log.info("control: main mute =", mute);
        return;
      }

      // --- メイン Volume ---
      if (address === "/mt48/main/volume") {
        const value = firstNumber(args);
        if (value === undefined) {
          log.warn("control: /mt48/main/volume に数値引数がありません");
          return;
        }
        const volume = clampVolume(value);
        publish(SPEAKER_SET, { volume });
        log.info("control: main volume =", volume);
        return;
      }

      // --- Phone Volume ---
      const phoneMatch = PHONE_VOLUME.exec(address);
      if (phoneMatch) {
        const phoneNo = Number.parseInt(phoneMatch[1] as string, 10);
        const monitorId = phoneMonitors.get(phoneNo);
        if (monitorId === undefined) {
          log.warn(`control: Phone${phoneNo} のモニター ID が未解決です（無視）`);
          return;
        }
        const value = firstNumber(args);
        if (value === undefined) {
          log.warn(`control: ${address} に数値引数がありません`);
          return;
        }
        const volume = clampVolume(value);
        publish(monitorPath(monitorId), { volume });
        log.info(`control: phone${phoneNo} volume =`, volume);
        return;
      }

      log.debug("control: 未対応アドレス", address);
    },
  };
}
